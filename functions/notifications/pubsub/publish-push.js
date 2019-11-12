const assert = require('assert');
const log = require('../../utils/logger');
const pushToUsersDevices = require('../utils/push-to-users-devices');
const notificationsModel = require('../../models/notifications');

const PREFIX = 'notifications: pubsub: publish-push-notification:';

/**
 * Publish all push nofication to their
 * user's registration token and remove the
 * push notification's configuration on success
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @param  {firebaseAdmin.messaging} messaging
 * @return {functions.CloudFunction}
 */
module.exports = function publishPushNotification(
  topic = '',
  pubSub,
  db,
  messaging
) {
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(Boolean(pubSub), 'has pubsub firebase instance');
  assert(Boolean(db), 'has firebase admin database instance');
  assert(Boolean(messaging), 'has firebase messaging instance');

  return pubSub.topic(topic).onPublish(async message => {
    const pushNotifications = [];

    // Parse individual target
    // from message or select all
    let srcTarget = '*';
    try {
      srcTarget = message.data
        ? Buffer.from(message.data, 'base64').toString()
        : '*';
    } catch (err) {
      log.warn(
        `${PREFIX} message parsing failed targeting all push notifications`
      );
    }

    try {
      let pushTree = null;

      if (srcTarget !== '*') {
        // Select all push notification(s) for a source notification
        log.info(
          `${PREFIX} ${topic}: publishing push messages for: ${srcTarget}`
        );

        const pushSnap = await notificationsModel.findPushBySrc(db, srcTarget);
        pushTree = pushSnap.val() || {};
      } else {
        log.info(`${PREFIX} ${topic}: publishing all push messages`);

        // Select all push notifications
        const pushSnap = await notificationsModel.findAllPush(db);
        pushTree = pushSnap.val() || {};
      }

      // Append each push notifications to queue
      Object.keys(pushTree).forEach(pushId => {
        pushNotifications.push({ id: pushId, ...pushTree[pushId] });
      });
    } catch (err) {
      throw Error(
        `${PREFIX} ${topic}: failed find all push notifications | ${err}`
      );
    }

    for (let i = 0; i < pushNotifications.length; i++) {
      const pushNotification = pushNotifications[i];
      const pushNotificationId = pushNotification.id;
      const userId = pushNotification.user;
      const pushData = Object.assign({}, pushNotification);
      delete pushData.id;
      delete pushData.user;
      delete pushData.createdAt;
      delete pushData.src;

      try {
        // Publish push notification
        await pushToUsersDevices(db, messaging, userId, pushData);

        // Remove push notification record
        await notificationsModel.removePush(db, pushNotificationId);
        log.info(
          `${PREFIX} ${topic}: published push "${pushNotificationId}" successfully`
        );
      } catch (err) {
        log.error(
          `${PREFIX} ${topic}: failed to publish "${pushNotificationId}" | ${err}`
        );
      }
    }
  });
};
