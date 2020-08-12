const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const { firebase: firebaseConfig } = require('../config');

const PREFIX = 'models: notifications:';
const NOTIFICATIONS_COLLECTION = 'notifications';
const SRC_NOTIFICATION_PATH = '/notifications/src';
const SLACK_NOTIFICATION_PATH = '/notifications/slack';
const PUSH_NOTIFICATION_PATH = '/notifications/push';
const STAGING_DATABASE_URL = firebaseConfig.stagingDatabaseURL || '';

module.exports = modelSetup({
  /**
   * Find all source notifications
   * @param  {firebase.database} db
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAllSrc(db) {
    return db.ref(SRC_NOTIFICATION_PATH).once('value');
  },

  /**
   * Remove a source notification
   * @param  {admin.database} db firbase database
   * @param  {String} notificationId
   * @return {Promise}
   */
  removeSrc(db, notificationId) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} removeSrc: has notification ID`
    );
    return db.ref(`${SRC_NOTIFICATION_PATH}/${notificationId}`).remove();
  },

  /**
   * Create a new source notification
   * @param  {admin.database} db firbase database
   * @param  {Object} notification
   * @return {Promise}
   */
  createSrc(db, notification) {
    assert(
      notification && typeof notification === 'object',
      'has notification configuration'
    );

    const { title, summary, creator } = notification;
    assert(title && typeof title === 'string', 'has notification title');
    assert(summary && typeof summary === 'string', 'has notification summary');
    assert(typeof creator === 'string', 'has notification creator');

    // Prefix Staging notifcation titles
    if (
      db.app &&
      db.app.options &&
      db.app.options.databaseURL === STAGING_DATABASE_URL
    ) {
      notification.title = `[STAGING] ${title}`;
    }

    const ref = db.ref(SRC_NOTIFICATION_PATH).push();
    return ref.set(notification);
  },

  /**
   * Push a Slack notification to a
   * specified channel name resolving
   * DB reference to the new notification
   * TODO: Deprecate
   * @param  {admin.database} db firbase database
   * @param  {String} channelName
   * @param  {Object} notification
   * @return {Promise} - resolves {db.Ref}
   */
  async pushToSlackChannel(db, channelName, notification = {}) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} pushToSlackChannel: has Slack channel name`
    );
    assert(
      notification && notification.title && notification.message,
      `${PREFIX} pushToSlackChannel: has valid notification`
    );

    const notificationRef = db
      .ref(`${SLACK_NOTIFICATION_PATH}/${channelName}`)
      .push();

    try {
      await notificationRef.set(notification);
    } catch (err) {
      throw Error(`${PREFIX} pushToSlackChannel: ${err}`); // wrap error
    }

    return notificationRef;
  },

  /**
   * Add a slack notification to a notification channel
   * @param  {admin.database} db firbase database
   * @param  {String} channelName
   * @param  {String} notificationId
   * @param  {Object} notification
   * @return {Promise} - resolves {db.Ref}
   */
  addToSlackChannel(db, channelName, notificationId, notification = {}) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} addToSlackChannel: has Slack channel name`
    );
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} addToSlackChannel: has notification ID`
    );
    assert(
      notification && notification.message && notification.src,
      `${PREFIX} addToSlackChannel: has valid notification`
    );

    const ref = db.ref(
      `${SLACK_NOTIFICATION_PATH}/${channelName}/${notificationId}`
    );

    return ref
      .set(notification)
      .then(() => ref)
      .catch(err =>
        Promise.reject(
          Error(`${PREFIX} addToSlackChannel | ${err}`) // wrap error
        )
      );
  },

  /**
   * Atomically write a group of push
   * notifications to the the database
   * while marking the source notification's
   * published mediums for push
   * NOTE: /notifications/push/*
   * @param  {admin.database} db firbase database
   * @param  {String} notificationId
   * @param  {Object[]} notifications
   * @return {Object} - result
   */
  createAllPush(db, notificationId, notifications) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} createAllPush: has notification ID`
    );
    assert(
      Array.isArray(notifications) &&
        notifications.every(n => typeof n === 'object'),
      `${PREFIX} createAllPush: has notifications configs`
    );

    const updates = {};
    const parentRef = db.ref(PUSH_NOTIFICATION_PATH);

    notifications.forEach(notification => {
      const ref = parentRef.push();
      const path = ref.path.toString();

      // Append notification to updates
      updates[path] = notification;
    });

    /**
     * @type {CreateAllPushResult}
     * @param {Object} publishedMediums
     */
    const result = {
      publishedMediums: {
        push: true,
      },
    };

    // Append source published mediums
    updates[
      `${SRC_NOTIFICATION_PATH}/${notificationId}/publishedMediums/push`
    ] = true;

    // Write all
    return db
      .ref()
      .update(updates)
      .then(() => result);
  },

  /**
   * Update a source notification's published mediums
   * @param  {admin.database} db firbase database
   * @param  {String} notificationId
   * @param  {Object} update
   * @return {Promise}
   */
  updateSrcPublishedMediums(db, notificationId, update) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} updateSrcPublishedMediums: has notification ID`
    );
    assert(
      update && typeof update === 'object',
      `${PREFIX} updateSrcPublishedMediums: has published medium updates`
    );

    return db
      .ref(`${SRC_NOTIFICATION_PATH}/${notificationId}/publishedMediums`)
      .update(update)
      .catch(err =>
        Promise.reject(
          Error(`${PREFIX} updateSrcPublishedMediums | ${err}`) // wrap error
        )
      );
  },

  /**
   * Return all push notification records
   * @param  {admin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAllPush(db) {
    return db.ref(PUSH_NOTIFICATION_PATH).once('value');
  },

  /**
   * Find Push Notifications for a source notification
   * @param {admin.database} db firbase database
   * @param {String} srcNotificationId
   */
  findPushBySrc(db, srcNotificationId) {
    assert(
      srcNotificationId && typeof srcNotificationId === 'string',
      `${PREFIX} findPush: has push notification ID`
    );

    return db
      .ref(`${PUSH_NOTIFICATION_PATH}`)
      .orderByChild('src')
      .equalTo(srcNotificationId)
      .once('value');
  },

  /**
   * Remove a push notification record
   * @param  {admin.database} db firbase database
   * @param  {String} pushNotificationId
   * @return {Promise}
   */
  removePush(db, pushNotificationId) {
    assert(
      pushNotificationId && typeof pushNotificationId === 'string',
      `${PREFIX} removePush: has push notification ID`
    );
    return db.ref(`${PUSH_NOTIFICATION_PATH}/${pushNotificationId}`).remove();
  },

  /**
   * Find a user's registration tokens
   * DEPRECATED
   * @param  {admin.database} db firbase database
   * @param  {String} notificationId
   * @return {Promise} - resolves {DataSnapshot}
   */
  findUserRegistrationTokens(db, userId) {
    assert(
      userId && typeof userId === 'string',
      `${PREFIX} findUserRegistrationTokens: has user ID`
    );
    return db.ref(`/registrationTokens/${userId}`).once('value');
  },

  /**
   * Find all slack notifications
   * @param  {admin.firestore} fs
   * @return {Promise}
   */
  firestoreFindAll(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(NOTIFICATIONS_COLLECTION).get();
  },

  /**
   * Find all slack notifications
   * @param  {admin.firestore} fs
   * @return {Promise}
   */
  firestoreFindAllSlack(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs
      .collection(NOTIFICATIONS_COLLECTION)
      .where('medium', '==', 'slack')
      .get();
  },

  /**
   * Remove all notifications intended for Slack
   * @param  {admin.firestore} fs
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async firestoreRemoveAllSlack(fs, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (parentBatch) {
      assert(typeof parentBatch.delete === 'function', 'has firestore batch');
    }

    const batch = parentBatch || fs.batch();

    // Lookup all slack medium notifications
    let slackNotificationsSnap = null;
    try {
      slackNotificationsSnap = await this.firestoreFindAllSlack(fs);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreRemoveAllSlack: failed to lookup notifications | ${err}`
      );
    }

    // Add each notification to delete batch
    slackNotificationsSnap.docs.forEach(notificationDoc =>
      batch.delete(notificationDoc.ref)
    );

    // Only commit local batched deletes
    if (!parentBatch) {
      return batch.commit();
    }
  },

  /**
   * Create a Firestore notification
   * @param  {admin.firestore} fs
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreAddRecord(fs, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    if (data.message) {
      assert(typeof data.message === 'string', 'data has message string');
    }
    if (data.title) {
      assert(typeof data.title === 'string', 'data has title string');
    }
    if (data.src) {
      assert(typeof data.src === 'string', 'data has src string');
    }
    if (data.channel) {
      assert(typeof data.channel === 'string', 'data has channel string');
    }
    if (data.medium) {
      assert(typeof data.medium === 'string', 'data has medium string');
    }
    if (batch) {
      assert(typeof batch.create === 'function', 'has firestore batch');
    }

    // Generates a document with a new ID
    const doc = fs.collection(NOTIFICATIONS_COLLECTION).doc();

    if (batch) {
      batch.create(doc, data);
      return Promise.resolve(doc);
    }

    return doc.create(data);
  },

  /**
   * Lookup Firestore Notification
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} notificationId
   * @return {Promise}
   */
  firestoreFindRecord(fs, notificationId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    return fs
      .collection(NOTIFICATIONS_COLLECTION)
      .doc(notificationId)
      .get();
  },

  /**
   * Update Firestore notification
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreUpdateRecord(fs, notificationId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = fs.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Create a Firestore notification
   * @param  {admin.firestore} fs
   * @param  {String?} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, notificationId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (notificationId) {
      assert(typeof notificationId === 'string', 'has notification id');
    }
    assert(data && typeof data === 'object', 'has data');
    if (batch) {
      assert(typeof batch.create === 'function', 'has firestore batch');
    }
    notificationId =
      notificationId || fs.collection(NOTIFICATIONS_COLLECTION).doc().id;
    const doc = fs.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      return Promise.resolve(batch.create(doc, data));
    }

    return doc.create(data);
  },

  /**
   * Query all notifications
   * @param  {admin.firestore} fs
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQuery(fs, query, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
    }

    let fsQuery = fs.collection(NOTIFICATIONS_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      fsQuery = fsQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      return Promise.resolve(transaction.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Delete Firestore Notification
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} notificationId
   * @param  {firestore.batch?} batch
   * @return {Promise} resolves {Document}
   */
  firestoreDestroyRecord(fs, notificationId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }
    const doc = fs.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve(doc);
    }

    return doc.delete();
  },
});
