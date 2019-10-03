const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');
const notificationsModel = require('../models/notifications');
const getRecepients = require('./utils/get-push-recepients');

const PREFIX = 'notifications: on-create-src-push-watcher:';

/**
 * Factory for watcher to create push notifications
 * for all relevant recipents from a source
 * notification created in database
 * NOTE: source notications `/notifications/src/*`
 * NOTE: slack notications `/notifications/push/*`
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} pushNotificationsSyncTopic
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnCreateSrcPushNotification(
  db,
  pubsubClient,
  pushNotificationsSyncTopic
) {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(Boolean(pubsubClient), 'has pubsub client');
  assert(
    pushNotificationsSyncTopic &&
      typeof pushNotificationsSyncTopic === 'string',
    'has notification topic'
  );

  const publisher = pubsubClient.topic(pushNotificationsSyncTopic).publisher();

  return async (change, event) => {
    const { notificationId } = event.params;
    const notification = change.val();
    const creatorId = notification ? notification.creator || '' : '';

    if (!notification || !notification.title || !notification.summary) {
      throw Error(
        `${PREFIX} invalid source notification: "${JSON.stringify(
          notification
        )}"`
      );
    }

    // Lookup all users
    const users = [];
    try {
      const usersSnap = await usersModel.findAll(db);
      const usersTree = usersSnap.val() || {};
      Object.keys(usersTree).forEach(userId => {
        const user = usersTree[userId];

        // Collect all users that
        // are not opting out of push
        // and didn't create the notification
        if (
          user &&
          typeof user === 'object' &&
          !user.pushOptOut &&
          userId !== creatorId
        ) {
          users.push(Object.assign({ id: userId }, user));
        }
      });
    } catch (err) {
      throw Error(`${PREFIX} failed to get users | ${err}`);
    }

    // Collect all push recipents
    const property = notification.property || '';
    const recipientIds = getRecepients({
      users,
      allowCorp: Boolean(property),
      allowTeamLead: Boolean(property),
      property,
    });

    // Create all notification configurations
    const { title, summary: message } = notification;
    const createdAt = Math.round(Date.now() / 1000);
    const pushNotifications = recipientIds.map(user => ({
      title,
      message,
      user,
      createdAt,
    }));

    // Atomically write all push notifications for all recipients
    let result = null;
    try {
      result = await notificationsModel.createAllPush(
        db,
        notificationId,
        pushNotifications
      );

      log.info(
        `${PREFIX} successfully created push notification records for notification: "${notificationId}"`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} failed to write all push notifications to database | ${err}`
      );
    }

    if (!result.publishedMediums.push) {
      log.error(`${PREFIX} failed to mark published mediums`);
    }

    // Publish notification push sync
    // event for all push notifications
    await publisher.publish(Buffer.from(''));
  };
};
