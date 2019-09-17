const assert = require('assert');
const log = require('../utils/logger');
const propertiesModel = require('../models/properties');
const integrationsModel = require('../models/integrations');
const notificationsModel = require('../models/notifications');

const PREFIX = 'notifications: on-create-src-slack-watcher:';

/**
 * Factory for watcher to create Slack notifications
 * from a source notification in the database
 * NOTE: source notications `/notifications/src/*`
 * NOTE: slack notications `/notifications/slack/channel/*`
 * @param  {firebaseAdmin.database} database - Firebase Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} notificationsSyncTopic
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnCreateSrcSlackNotification(
  db,
  pubsubClient,
  notificationsSyncTopic
) {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(Boolean(pubsubClient), 'has pubsub client');
  assert(
    notificationsSyncTopic && typeof notificationsSyncTopic === 'string',
    'has notification topic'
  );

  const publisher = pubsubClient.topic(notificationsSyncTopic).publisher();

  return async (change, event) => {
    const { notificationId } = event.params;
    const srcNotification = change.val();
    const {
      title,
      summary,
      property: propertyId,
      markdownBody,
      publishedMediums,
    } = srcNotification;

    assert(Boolean(notificationId), 'has deficient item ID');
    assert(Boolean(srcNotification), 'has source notification');

    // Slack notification previously configured
    if (publishedMediums && publishedMediums.slack) {
      return;
    }

    log.info(`${PREFIX} source notification "${notificationId}" discovered`);

    // Reject invalid source notification
    if (!title) {
      throw Error(`${PREFIX} source notification has invalid title: ${title}`);
    } else if (!summary) {
      throw Error(
        `${PREFIX} source notification has invalid summary: ${summary}`
      );
    }

    let channelName = '';

    // Property notification
    if (propertyId) {
      let property = null;
      try {
        const propertySnap = await propertiesModel.findRecord(db, propertyId);
        property = propertySnap.val();
        if (!property) throw Error('property does not exist');
      } catch (err) {
        throw Error(`${PREFIX} property lookup failed | ${err}`); // wrap error
      }

      channelName = property.slackChannel;
    }

    // Admin notification
    if (!propertyId) {
      try {
        const slackOrgSnap = await integrationsModel.getSlackOrganization(db);
        const adminChannelName = (slackOrgSnap.val() || {}).defaultChannelName;
        if (adminChannelName) channelName = adminChannelName;
      } catch (err) {
        throw Error(
          `${PREFIX} organization slack channel integration lookup failed | ${err}`
        ); // wrap error
      }
    }

    // Abandon when channel undiscovered
    if (!channelName) {
      const message = propertyId
        ? 'No Slack channel associated with this property'
        : 'Admin channel has not been setup';
      throw Error(`${PREFIX} ${message}`);
    }

    // Ensure channel `#` removed
    channelName = channelName.replace(/#/g, '');

    // Create notification record
    // and queue notification sync task
    try {
      const notificationRef = await notificationsModel.addToSlackChannel(
        db,
        channelName,
        notificationId,
        { title, message: markdownBody || summary }
      );

      log.info(
        `${PREFIX} created slack notification: ${notificationRef.path.toString()}`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} failed to create and/or publish Slack notification | ${err}`
      );
    }

    // Update the source notifications publised mediums
    try {
      await notificationsModel.updateSrcPublishedMediums(db, notificationId, {
        slack: true,
      });
    } catch (err) {
      log.error(`${PREFIX} failed to mark published mediums | ${err}`);
    }

    // Publish notification sync
    // event for the Slack channel
    await publisher.publish(Buffer.from(`slack/${channelName}`));
  };
};
