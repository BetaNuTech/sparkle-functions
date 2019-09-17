const assert = require('assert');
const log = require('../utils/logger');
const createSlackNotification = require('./utils/create-slack');

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

    let slackNotification = null;
    try {
      slackNotification = await createSlackNotification(
        db,
        notificationId,
        change.val()
      );

      log.info(
        `${PREFIX} created slack notification: ${slackNotification.path}`
      );
    } catch (err) {
      throw Error(`${PREFIX} failed to create Slack notification | ${err}`);
    }

    if (!slackNotification.publishedMediums.slack) {
      log.error(`${PREFIX} failed to mark published mediums`);
    }

    // Publish notification slack sync
    // event for the Slack channel
    await publisher.publish(Buffer.from(slackNotification.channel));
  };
};
