const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const notificationsModel = require('../../models/notifications');
const regTokensModel = require('../../models/registration-tokens');
const publishPushMessage = require('../utils/publish-push-message');

const PREFIX = 'notifications: pubsub: publish-push-v2:';

// Stop retrying a push message that keeps
// failing once it is a day old. The hourly
// resend job would otherwise retry it forever
const MAX_RETRY_AGE = 60 * 60 * 24; // seconds

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
    messaging && typeof messaging.send === 'function',
    'has messaging instance'
  );

  return pubsub.topic(topic).onPublish(async message => {
    // Hash of each discovered
    // notification's push messages
    // { notification-id: { property, messages: [pushMessage] } }
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
        addPushMessages(
          notifications,
          notificationSnap.id,
          notificationSnap.data()
        );
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

        notificationsSnap.docs.forEach(doc =>
          addPushMessages(notifications, doc.id, doc.data())
        );
      } catch (err) {
        throw Error(
          `${PREFIX} failed lookup all notifications with unpublished push messages | ${err}`
        );
      }
    }

    const now = Math.round(Date.now() / 1000);
    const batch = db.batch();
    const notificationIds = Object.keys(notifications);
    const registrationTokenCache = {};
    const skipUserCache = {};

    for (let i = 0; i < notificationIds.length; i++) {
      const notificationId = notificationIds[i];
      const { property, messages: pushMessages } = notifications[
        notificationId
      ];
      let publishedMessages = 0;
      const notificationUpdate = {};

      for (let k = 0; k < pushMessages.length; k++) {
        const pushMessage = pushMessages[k];
        const userId = pushMessage.user;

        // Skip users who opted out of push since
        // the message was created, or were removed
        if (skipUserCache[userId] === undefined) {
          try {
            const userSnap = await usersModel.findRecord(db, userId);
            const user = userSnap.data();
            skipUserCache[userId] = !user || Boolean(user.pushOptOut);
          } catch (err) {
            log.error(`${PREFIX} failed to lookup user: "${userId}" | ${err}`);
            continue; // eslint-disable-line
          }
        }

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
        if (registrationTokens.length && !skipUserCache[userId]) {
          let result = null;
          try {
            result = await publishPushMessage(
              messaging,
              registrationTokens,
              pushMessage.title,
              pushMessage.message,
              { notificationId, propertyId: property }
            );
          } catch (err) {
            log.error(
              `${PREFIX} failed to publish push message for notification: "${notificationId}" | ${err}`
            );
            continue; // eslint-disable-line
          }

          // Remove tokens FCM rejected for good
          if (result.invalidTokens.length) {
            await removeInvalidTokens(db, userId, result.invalidTokens);
            registrationTokenCache[userId] = registrationTokens.filter(
              token => !result.invalidTokens.includes(token)
            );
          }

          if (result.successCount) {
            log.info(
              `${PREFIX} published notification: "${notificationId}" to ${result.successCount} of ${registrationTokens.length} devices of user: "${userId}"`
            );
          }

          // Some devices failed for a reason other
          // than a dead token and none succeeded:
          // leave the message for the next resend
          const hasOnlyTemporaryFailures =
            result.successCount === 0 && result.errors.length > 0;
          if (hasOnlyTemporaryFailures) {
            const age = now - (pushMessage.createdAt || now);
            const errMsg = result.errors.map(err => `${err}`).join(', ');

            if (age < MAX_RETRY_AGE) {
              log.error(
                `${PREFIX} failed to publish push message for notification: "${notificationId}" to user: "${userId}", will retry | ${errMsg}`
              );
              continue; // eslint-disable-line
            }

            log.error(
              `${PREFIX} abandoning push message for notification: "${notificationId}" to user: "${userId}" after ${age}s | ${errMsg}`
            );
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

/**
 * Add a notification's push
 * messages to the publish hash
 * @param {Object} notifications - publish hash
 * @param {String} notificationId
 * @param {Object?} notificationData
 */
function addPushMessages(notifications, notificationId, notificationData) {
  const data = notificationData || {};
  const userIds = Object.keys(data.push || {});

  if (userIds.length) {
    notifications[notificationId] = {
      property: data.property || '',
      messages: userIds.map(userId => ({
        user: userId,
        ...data.push[userId],
      })),
    };
  }
}

/**
 * Remove tokens that FCM reports as
 * unregistered or invalid. Written
 * immediately, outside the shared
 * batch, and allowed to fail
 * @param  {admin.firestore} db
 * @param  {String} userId
 * @param  {String[]} tokens
 * @return {Promise}
 */
async function removeInvalidTokens(db, userId, tokens) {
  try {
    await regTokensModel.removeTokens(db, userId, tokens);
    log.info(
      `${PREFIX} removed ${tokens.length} invalid registration token(s) of user: "${userId}"`
    );
  } catch (err) {
    log.error(
      `${PREFIX} failed to remove invalid registration tokens of user: "${userId}" | ${err}`
    );
  }
}
