const assert = require('assert');
const log = require('../utils/logger');
const createSlackNotification = require('./utils/create-slack-v2');
const createPushNotifications = require('./utils/create-push-v2');

const PREFIX = 'notifications: on-create-v2:';

/**
 * Factory for on createnotification handler
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} slackPublishTopic
 * @param  {String} pushPublishTopic
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnCreatekNotification(
  db,
  pubsubClient,
  slackPublishTopic,
  pushPublishTopic
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(
    pubsubClient && typeof pubsubClient.topic === 'function',
    'has pubsub client'
  );
  assert(
    slackPublishTopic && typeof slackPublishTopic === 'string',
    'has slack notification topic'
  );
  assert(
    pushPublishTopic && typeof pushPublishTopic === 'string',
    'has push notification topic'
  );

  const slackPublisher = pubsubClient.topic(slackPublishTopic).publisher();
  const pushPublisher = pubsubClient.topic(pushPublishTopic).publisher();

  return async (doc, event) => {
    const { notificationId } = event.params;
    const notification = doc.data();

    // Configure notification for Slack message
    let slackNotification = null;
    try {
      slackNotification = await createSlackNotification(
        db,
        notificationId,
        notification
      );
    } catch (err) {
      log.error(`${PREFIX} failed to update notification for Slack | ${err}`);
    }

    // Publish notification slack sync
    // event for the Slack channel
    if (slackNotification && slackNotification.channel) {
      try {
        await slackPublisher.publish(Buffer.from(slackNotification.channel));
      } catch (err) {
        log.error(`${PREFIX} failed to publish slack event | ${err}`);
      }
    }

    // Configure notification for all push notifications
    let pushNotifications = null;
    try {
      pushNotifications = await createPushNotifications(
        db,
        notificationId,
        notification
      );
    } catch (err) {
      throw Error(`${PREFIX} failed to create push notifications | ${err}`);
    }

    // Publish notification push sync
    // event for all push notifications
    if (pushNotifications && Object.keys(pushNotifications).length) {
      try {
        await pushPublisher.publish(Buffer.from(notificationId));
      } catch (err) {
        log.error(`${PREFIX} failed to publish push event | ${err}`);
      }
    }
  };
};
