const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const log = require('../../utils/logger');
const notificationsModel = require('../../models/notifications');
const regTokensModel = require('../../models/registration-tokens');
const publishPushMessage = require('../utils/publish-push-message');

const PREFIX = 'notifications: pubsub: publish-push-v2:';

/**
 * Publish all push nofication to their
 * user's registration token and remove the
 * push notification's configuration on success
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubSub
 * @param  {String} topic
 * @param  {admin.messaging} messaging
 * @return {functions.CloudFunction}
 */
module.exports = function publishPushNotification(
  db,
  pubsub,
  topic = '',
  messaging
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(
    messaging && typeof messaging.sendToDevice === 'function',
    'has messaging instance'
  );

  return pubsub.topic(topic).onPublish(async message => {
    // Hash of each discovered
    // notification's push messages
    // { notification-id: [pushMessage] }
    const notifications = {};

    // Parse individual target
    // from message or select all
    let srcTarget = '*';
    try {
      srcTarget =
        message && message.data
          ? Buffer.from(message.data, 'base64').toString()
          : '*';
    } catch (err) {
      log.warn(
        `${PREFIX} message parsing failed, targeting all push notifications | ${err}`
      );
    }

    if (srcTarget !== '*') {
      try {
        const notificationSnap = await notificationsModel.findRecord(
          db,
          srcTarget
        );
        const notificationData = notificationSnap.data() || {};
        const notificationPushIds = Object.keys(notificationData.push || {});

        // Add any notification's
        // push messages to hash
        if (notificationPushIds.length) {
          notifications[notificationSnap.id] = notificationPushIds.map(
            userId => ({
              user: userId,
              ...notificationData.push[userId],
            })
          );
        }
      } catch (err) {
        throw Error(
          `${PREFIX} failed lookup notification: "${srcTarget}" | ${err}`
        );
      }
    } else {
      try {
        // Select all notifications with
        // any unpublished push messages
        const notificationsSnap = await notificationsModel.query(db, {
          unpublishedPush: ['>', 0],
        });

        // Add each notification's
        // push messages to hash
        notificationsSnap.docs.forEach(doc => {
          const notificationData = doc.data() || {};
          const notificationPushIds = Object.keys(notificationData.push || {});

          if (notificationPushIds.length) {
            notifications[doc.id] = notificationPushIds.map(userId => ({
              user: userId,
              ...notificationData.push[userId],
            }));
          }
        });
      } catch (err) {
        throw Error(
          `${PREFIX} failed lookup all notifications with unpublished push messages | ${err}`
        );
      }
    }

    const batch = db.batch();
    const notificationIds = Object.keys(notifications);
    const registrationTokenCache = {};

    for (let i = 0; i < notificationIds.length; i++) {
      const notificationId = notificationIds[i];
      const pushMessages = notifications[notificationId];
      let publishedMessages = 0;
      const notificationUpdate = {};

      for (let k = 0; k < pushMessages.length; k++) {
        const pushMessage = pushMessages[k];
        const userId = pushMessage.user;

        // Lookup user's push
        // message registration tokens
        let registrationTokens = registrationTokenCache[userId];
        if (!registrationTokens) {
          try {
            const registrationTokensSnap = await regTokensModel.findRecord(
              db,
              userId
            );
            registrationTokens = Object.keys(
              registrationTokensSnap.data() || {}
            );
            registrationTokenCache[userId] = registrationTokens; // update cache
          } catch (err) {
            log.error(
              `${PREFIX} failed to lookup user: "${userId}" registration tokens | ${err}`
            );
            continue; // eslint-disable-line
          }
        }

        // Publish push message to all
        // a user's registered devices
        if (registrationTokens && registrationTokens.length) {
          try {
            const pushMsgId = await publishPushMessage(
              messaging,
              registrationTokens,
              pushMessage.title,
              pushMessage.message
            );
            log.info(
              `${PREFIX} published multicast push message: "${pushMsgId}"`
            );
          } catch (err) {
            log.error(
              `${PREFIX} failed to publish push message for notification: "${notificationId}" | ${err}`
            );
            continue; // eslint-disable-line
          }
        }

        // Mark notification's messages published
        // or cleanup users without any registered tokens
        notificationUpdate[`push.${userId}`] = FieldValue.delete();
        publishedMessages++;
      }

      // Update unpublished counter
      const totalMessages = pushMessages.length;
      notificationUpdate.unpublishedPush = totalMessages - publishedMessages;

      // Mark push publish medium as done
      if (notificationUpdate.unpublishedPush === 0) {
        notificationUpdate['publishedMediums.push'] = true;
      }

      // Add notification's update to batch
      try {
        await notificationsModel.updateRecord(
          db,
          notificationId,
          notificationUpdate,
          batch
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed update notification: "${notificationId}" | ${err}`
        );
        continue; // eslint-disable-line
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} database writes failed to commit | ${err}`);
    }
  });
};
