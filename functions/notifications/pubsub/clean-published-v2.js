const assert = require('assert');
const log = require('../../utils/logger');
const notificationsModel = require('../../models/notifications');

const PREFIX = 'notifications: pubsub: publish-push-v2:';

/**
 * Remove all notifications that
 * have been completedly published
 * @param  {admin.firestore} fs
 * @param  {functions.pubsub} pubSub
 * @param  {String} topic
 * @param  {Number?} batchSize - how many records to remove per batch
 * @return {functions.CloudFunction}
 */
module.exports = function publishPushNotification(
  fs,
  pubsub,
  topic = '',
  batchSize = 499
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(
    batchSize && typeof batchSize === 'number' && batchSize >= 1,
    'has valid batch size number'
  );

  return pubsub.topic(topic).onPublish(async () => {
    const notificationIds = [];

    try {
      // Select all notifications
      // done publishing to both
      // slack and push
      const notificationsSnap = await notificationsModel.query(fs, {
        'publishedMediums.slack': ['==', true],
        'publishedMediums.push': ['==', true],
      });

      notificationsSnap.docs.forEach(doc => notificationIds.push(doc.id));
    } catch (err) {
      throw Error(
        `${PREFIX} failed lookup all notifications completed publishing | ${err}`
      );
    }

    while (notificationIds.length) {
      // All notification ID's to delete in batch
      const notificationIdsSegment = notificationIds.splice(0, batchSize);

      // Batch group notification deletes
      const batch = fs.batch();

      // Add segment delete to batch
      for (let i = 0; i < notificationIdsSegment.length; i++) {
        const notificationId = notificationIdsSegment[i];

        try {
          await notificationsModel.destroyRecord(fs, notificationId, batch);
        } catch (err) {
          log.error(
            `${PREFIX} failed to delete notification: "${notificationId}" | ${err}`
          );
          continue; // eslint-disable-line
        }
      }

      // Delete batch group
      try {
        await batch.commit();
      } catch (err) {
        throw Error(`${PREFIX} database writes failed to commit | ${err}`);
      }
    }
  });
};
