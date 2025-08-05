const assert = require('assert');
const log = require('../../utils/logger');
const config = require('../../config');
const clickup = require('../../services/clickup');
const usersModel = require('../../models/users');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const integrationsModel = require('../../models/integrations');
const parseDiStateEventMsg = require('../../trello/utils/parse-di-state-event-msg');
const findPreviousDIHistory = require('../../deficient-items/utils/find-history');
const { getBestStatusMatch, buildTaskComment } = require('../../clickup/utils');

const PREFIX = 'clickup: pubsub: deficiency-clickup-task-state-comment-v2:';
const INITIAL_DI_STATE = config.deficientItems.initialState;
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;

/**
 * Update ClickUp task status and add comments for deficiency state changes
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.cloudfunction}
 */
module.exports = function createClickUpTaskStateCommentV2(db, pubsub, topic) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');

  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficiencyId = '';
    let deficiencyState = '';

    // Parse event message
    try {
      [propertyId, deficiencyId, deficiencyState] = parseDiStateEventMsg(
        message
      );
    } catch (err) {
      throw Error(`${PREFIX} failed to parse pubsub message | ${err}`);
    }

    log.info(
      `${PREFIX} deficiency: "${deficiencyId}" state became: "${deficiencyState}"`
    );

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

    // Lookup ClickUp property integration
    let clickupPropertyConfig = null;
    try {
      const clickupIntegrationSnap = await integrationsModel.findClickUpProperty(
        db,
        propertyId
      );
      clickupPropertyConfig = clickupIntegrationSnap.data() || null;
      if (!clickupPropertyConfig || !clickupPropertyConfig.deficienciesListId) {
        throw Error('ClickUp integration not configured for property');
      }
    } catch (err) {
      log.warn(`${PREFIX} ClickUp property integration not found | ${err}`);
      return;
    }

    // Lookup Deficiency
    let deficiency = null;
    try {
      const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
      deficiency = deficiencySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed | ${err}`);
    }

    if (!deficiency) {
      log.error(`${PREFIX} bad deficiency reference: "${deficiencyId}"`);
      return;
    }

    // Get list details to find available statuses
    let listDetails = null;
    try {
      listDetails = await clickup.fetchList(
        clickupCredentials.apiToken,
        clickupPropertyConfig.deficienciesListId
      );
    } catch (err) {
      log.error(`${PREFIX} failed to fetch list details: ${err}`);
      return;
    }

    // Find the best status match for the new deficiency state
    const targetStatus = getBestStatusMatch(
      deficiencyState,
      listDetails.statuses || [],
      'deficiency'
    );

    // Update ClickUp task status
    try {
      await clickup.updateTask(clickupCredentials.apiToken, clickupTaskId, {
        status: targetStatus,
      });
      log.info(
        `${PREFIX} updated task ${clickupTaskId} status to: ${targetStatus}`
      );
    } catch (err) {
      log.error(`${PREFIX} failed to update ClickUp task status: ${err}`);
      // Continue to try adding comment even if status update fails
    }

    // Build and add comment about the state change
    try {
      // Lookup DI current & historical states
      const findHistory = findPreviousDIHistory(deficiency);
      const defStateHistory = findHistory('stateHistory');
      const currentDefStateHistory = defStateHistory.current;
      const previousDefStateHistory = defStateHistory.previous;
      const previousDefState = previousDefStateHistory
        ? previousDefStateHistory.state
        : INITIAL_DI_STATE;

      // Lookup user that created new deficiency State
      let stateAuthorsUser = null;
      const stateAuthorsUserId = currentDefStateHistory.user;
      try {
        const userSnap = await usersModel.findRecord(db, stateAuthorsUserId);
        stateAuthorsUser = userSnap.data();
      } catch (err) {
        log.error(`${PREFIX} user lookup failed: ${err}`);
        // Use fallback user data
        stateAuthorsUser = {
          firstName: 'Unknown',
          lastName: 'User',
          email: 'system@sparkle.com',
        };
      }

      // Build comment using the utility function
      const commentText = buildTaskComment(
        previousDefState,
        deficiencyState,
        {
          ...deficiency,
          firstName: stateAuthorsUser.firstName || 'Unknown',
          lastName: stateAuthorsUser.lastName || 'User',
          email: stateAuthorsUser.email || 'system@sparkle.com',
          currentResponsibilityGroup:
            RESPONSIBILITY_GROUPS[deficiency.currentResponsibilityGroup] || '',
        },
        'deficiency'
      );

      if (commentText) {
        await clickup.addTaskComment(
          clickupCredentials.apiToken,
          clickupTaskId,
          {
            comment_text: commentText,
            notify_all: false,
          }
        );
        log.info(
          `${PREFIX} added state change comment to task ${clickupTaskId}`
        );
      }
    } catch (err) {
      log.error(`${PREFIX} failed to add comment to ClickUp task: ${err}`);
      // Don't throw - status update may have succeeded
    }
  });
};
