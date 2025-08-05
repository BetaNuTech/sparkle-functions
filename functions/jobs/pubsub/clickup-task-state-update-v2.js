const assert = require('assert');
const log = require('../../utils/logger');
const clickup = require('../../services/clickup');
const systemModel = require('../../models/system');
const jobsModel = require('../../models/jobs');
const integrationsModel = require('../../models/integrations');
const usersModel = require('../../models/users');
const { getBestStatusMatch, buildTaskComment } = require('../../clickup/utils');

const PREFIX = 'clickup: pubsub: job-clickup-task-state-update-v2:';

/**
 * Update ClickUp task status and add comments for job state changes
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.cloudfunction}
 */
module.exports = function createClickUpJobTaskStateUpdateV2(db, pubsub, topic) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');

  return pubsub.topic(topic).onPublish(async message => {
    const messageData = message.data
      ? JSON.parse(Buffer.from(message.data, 'base64').toString())
      : {};
    const { propertyId, jobId, newState, previousState, userId } = messageData;

    if (!propertyId || !jobId || !newState) {
      log.error(`${PREFIX} missing required data in pubsub message`);
      return;
    }

    log.info(
      `${PREFIX} job: "${jobId}" state changed from "${previousState}" to "${newState}"`
    );

    // Find created ClickUp Task reference (jobs are prefixed with 'job-')
    let clickupTaskId = '';
    try {
      const allTasks = await systemModel.findClickUpProperty(db, propertyId);
      const propertyTasks = (allTasks.data() || {}).tasks || {};

      // Find task ID for this job
      clickupTaskId = Object.keys(propertyTasks).find(
        taskId => propertyTasks[taskId] === `job-${jobId}`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} system property ClickUp task lookup failed | ${err}`
      );
    }

    if (!clickupTaskId) {
      log.info(`${PREFIX} job has no ClickUp Task, exiting`);
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
      if (!clickupPropertyConfig || !clickupPropertyConfig.jobsListId) {
        throw Error('ClickUp jobs integration not configured for property');
      }
    } catch (err) {
      log.warn(`${PREFIX} ClickUp property integration not found | ${err}`);
      return;
    }

    // Get list details to find available statuses
    let listDetails = null;
    try {
      listDetails = await clickup.fetchList(
        clickupCredentials.apiToken,
        clickupPropertyConfig.jobsListId
      );
    } catch (err) {
      log.error(`${PREFIX} failed to fetch list details: ${err}`);
      return;
    }

    // Find the best status match for the new job state
    const targetStatus = getBestStatusMatch(
      newState,
      listDetails.statuses || [],
      'job'
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

    // Add comment about the state change
    if (userId) {
      try {
        // Lookup job data
        let job = null;
        try {
          const jobSnap = await jobsModel.findRecord(db, jobId);
          job = jobSnap.data() || null;
        } catch (err) {
          log.error(`${PREFIX} job lookup failed: ${err}`);
        }

        // Lookup user who made the change
        let user = null;
        try {
          const userSnap = await usersModel.findRecord(db, userId);
          user = userSnap.data();
        } catch (err) {
          log.error(`${PREFIX} user lookup failed: ${err}`);
          user = {
            firstName: 'Unknown',
            lastName: 'User',
            email: 'system@sparkle.com',
          };
        }

        // Build comment using the utility function
        const commentText = buildTaskComment(
          previousState || 'unknown',
          newState,
          {
            ...job,
            firstName: user.firstName || 'Unknown',
            lastName: user.lastName || 'User',
            email: user.email || 'system@sparkle.com',
          },
          'job'
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
    }
  });
};
