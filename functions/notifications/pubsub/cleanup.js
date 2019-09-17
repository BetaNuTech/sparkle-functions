const assert = require('assert');
const log = require('../../utils/logger');
const notificationsModel = require('../../models/notifications');
const createSlackNotification = require('../utils/create-slack');

const PREFIX = 'notifications: pubsub: cleanup:';

/**
 * Remove published notifications
 * and retry lingering ones
 * @param  {firebaseAdmin.database} db
 * @param  {functions.pubsub} pubSub
 * @param  {functions.pubsub} pubSubClient
 * @param  {String} topic
 * @param  {String} slackTopic
 * @return {functions.CloudFunction}
 */
module.exports = function cleanupNotifications(
  db,
  pubSub,
  pubSubClient,
  topic = '',
  slackTopic = ''
) {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(Boolean(pubSub), 'has pubsub');
  assert(Boolean(pubSubClient), 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has primary topic');
  assert(slackTopic && typeof slackTopic === 'string', 'has slack topic');

  const slackPublisher = pubSubClient.topic(slackTopic).publisher();

  return pubSub.topic(topic).onPublish(async () => {
    let notifications = null;
    try {
      const notificationsSnap = await notificationsModel.findAllSrc(db);
      notifications = notificationsSnap.val() || {};
    } catch (err) {
      throw Error(`${PREFIX} source notification lookup failed | ${err}`);
    }

    const notificationIds = Object.keys(notifications);

    for (let i = 0; i < notificationIds.length; i++) {
      const notificationId = notificationIds[i];
      const notification = notifications[notificationId];

      if (
        notification.publishedMediums &&
        notification.publishedMediums.slack
      ) {
        // Remove published notification
        try {
          await notificationsModel.removeSrc(db, notificationId);
        } catch (err) {
          log.error(
            `${PREFIX} failed to cleanup notification "${notificationId}" | ${err}`
          );
        }
      } else {
        // Resend unpublished Slack
        try {
          const { path, channel } = await createSlackNotification(
            db,
            notificationId,
            notification
          );

          log.info(`${PREFIX} created slack notification at ${path}`);

          // Publish notification slack sync
          // event for the Slack channel
          await slackPublisher.publish(Buffer.from(channel));
        } catch (err) {
          log.error(
            `${PREFIX} failed to republish slack notification "${notificationId}" | ${err}`
          );
        }
      }
    }
  });
};
