const assert = require('assert');
const log = require('../utils/logger');
const createPush = require('./utils/create-push');

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

    let result = null;
    try {
      result = await createPush(db, notificationId, notification);

      log.info(
        `${PREFIX} successfully created push notification records for notification: "${notificationId}"`
      );
    } catch (err) {
      throw Error(`${PREFIX} failed to create push notifications | ${err}`);
    }

    if (!result.publishedMediums.push) {
      log.error(`${PREFIX} failed to mark published mediums`);
    }

    // Publish notification push sync
    // event for all push notifications
    await publisher.publish(Buffer.from(''));
  };
};
