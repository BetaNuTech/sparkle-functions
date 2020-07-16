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
 * @return {functions.CloudFunction}
 */
module.exports = function publishPushNotification(fs, pubsub, topic = '') {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');

  return pubsub.topic(topic).onPublish(async () => {
    const notificationIds = [];
    try {
      // Select all notifications
      // done publishing to both
      // slack and push
      const notificationsSnap = await notificationsModel.firestoreQuery(fs, {
        'publishedMediums.slack': ['==', true],
        'publishedMediums.push': ['==', true],
      });

      notificationsSnap.docs.forEach(doc => notificationIds.push(doc.id));
    } catch (err) {
      throw Error(
        `${PREFIX} failed lookup all notifications completed publishing | ${err}`
      );
    }

    // Batch all notification deletes
    const batch = fs.batch();
    for (let i = 0; i < notificationIds.length; i++) {
      const notificationId = notificationIds[i];

      try {
        await notificationsModel.firestoreDestroyRecord(
          fs,
          notificationId,
          batch
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed to delete notification: "${notificationId}" | ${err}`
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
