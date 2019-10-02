const assert = require('assert');
// const log = require('../utils/logger');
// const getRecepients = require('./utils/get-push-recepients');

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

  // const publisher = pubsubClient.topic(pushNotificationsSyncTopic).publisher();

  return async (change /* , event */) => {
    // const { notificationId } = event.params;
    const notification = change.val();

    if (!notification || !notification.title || !notification.summary) {
      throw Error(
        `${PREFIX} invalid source notification: "${JSON.stringify(
          notification
        )}"`
      );
    }

    // TODO create notification config
    // TODO get all users
    // TODO get opt outs
    // TODO get recipients
    // TODO write /notifications/push for each recipient
    // TODO updateSrcPublishedMediums after push recipient writes
    // TODO do not finish cleanup push set on published mediums
  };
};
