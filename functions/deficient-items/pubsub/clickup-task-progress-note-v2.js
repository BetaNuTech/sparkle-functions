const assert = require('assert');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const config = require('../../config');
const clickup = require('../../services/clickup');
const usersModel = require('../../models/users');
const systemModel = require('../../models/system');

const PREFIX = 'clickup: pubsub: deficiency-clickup-task-progress-note-v2:';

/**
 * Add ClickUp task comments for deficiency progress notes
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.cloudfunction}
 */
module.exports = function createClickUpTaskProgressNoteV2(db, pubsub, topic) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');

  // Progress note template
  const progressNoteTemplate = hbs.compile(config.clickup.progressNoteTemplate);

  return pubsub.topic(topic).onPublish(async message => {
    const messageData = message.data
      ? JSON.parse(Buffer.from(message.data, 'base64').toString())
      : {};
    const { propertyId, deficiencyId, progressNote, userId } = messageData;

    if (!propertyId || !deficiencyId || !progressNote) {
      log.error(`${PREFIX} missing required data in pubsub message`);
      return;
    }

    log.info(`${PREFIX} progress note added to deficiency: "${deficiencyId}"`);

    // Find created ClickUp Task reference
    let clickupTaskId = '';
    try {
      clickupTaskId = await systemModel.findClickUpTaskId(
        db,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      throw Error(
        `${PREFIX} system property ClickUp task id lookup failed | ${err}`
      );
    }

    if (!clickupTaskId) {
      log.info(`${PREFIX} deficiency has no ClickUp Task, exiting`);
      return;
    }

    // Lookup ClickUp credentials
    let clickupCredentials = null;
    try {
      const clickupCredentialsSnap = await systemModel.findClickUp(db);
      clickupCredentials = clickupCredentialsSnap.data();
      if (!clickupCredentials) {
        throw Error('Organization has not authorized ClickUp');
      }
    } catch (err) {
      log.warn(`${PREFIX} ClickUp credentials not found | ${err}`);
      return;
    }

    // Lookup user who added the progress note
    let user = null;
    try {
      const userSnap = await usersModel.findRecord(db, userId);
      user = userSnap.data();
    } catch (err) {
      log.error(`${PREFIX} user lookup failed: ${err}`);
      // Use fallback user data
      user = {
        firstName: 'Unknown',
        lastName: 'User',
        email: 'system@sparkle.com',
      };
    }

    // Build and add progress note comment
    try {
      const commentText = progressNoteTemplate({
        firstName: user.firstName || 'Unknown',
        lastName: user.lastName || 'User',
        email: user.email || 'system@sparkle.com',
        progressNote,
      });

      await clickup.addTaskComment(clickupCredentials.apiToken, clickupTaskId, {
        comment_text: commentText,
        notify_all: false,
      });

      log.info(
        `${PREFIX} added progress note comment to task ${clickupTaskId}`
      );
    } catch (err) {
      log.error(
        `${PREFIX} failed to add progress note comment to ClickUp task: ${err}`
      );
    }
  });
};
