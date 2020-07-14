const assert = require('assert');
const log = require('../utils/logger');
const createSlackNotification = require('./utils/create-slack-v2');

const PREFIX = 'notifications: on-create-v2:';

/**
 * Factory for on createnotification handler
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} slackPublishTopic
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnCreatekNotification(
  fs,
  pubsubClient,
  slackPublishTopic
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(
    pubsubClient && typeof pubsubClient.topic === 'function',
    'has pubsub client'
  );
  assert(
    slackPublishTopic && typeof slackPublishTopic === 'string',
    'has notification topic'
  );

  const slackPublisher = pubsubClient.topic(slackPublishTopic).publisher();

  return async (doc, event) => {
    const { notificationId } = event.params;

    let slackNotification = null;
    try {
      slackNotification = await createSlackNotification(
        fs,
        notificationId,
        doc.data()
      );
    } catch (err) {
      log.error(`${PREFIX} failed to update notification for Slack | ${err}`);
    }

    // Publish notification slack sync
    // event for the Slack channel
    if (slackNotification && slackNotification.channel) {
      await slackPublisher.publish(Buffer.from(slackNotification.channel));
    }
  };
};
