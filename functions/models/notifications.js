const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: notifications:';
const NOTIFICATIONS_COLLECTION = 'notifications';

module.exports = modelSetup({
  /**
   * Find all slack notifications
   * @param  {admin.firestore} db
   * @return {Promise}
   */
  findAll(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(NOTIFICATIONS_COLLECTION).get();
  },

  /**
   * Find all slack notifications
   * @param  {admin.firestore} db
   * @return {Promise}
   */
  findAllSlack(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('medium', '==', 'slack')
      .get();
  },

  /**
   * Remove all notifications intended for Slack
   * @param  {admin.firestore} db
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async removeAllSlack(db, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (parentBatch) {
      assert(typeof parentBatch.delete === 'function', 'has firestore batch');
    }

    const batch = parentBatch || db.batch();

    // Lookup all slack medium notifications
    let slackNotificationsSnap = null;
    try {
      slackNotificationsSnap = await this.findAllSlack(db);
    } catch (err) {
      throw Error(
        `${PREFIX} removeAllSlack: failed to lookup notifications | ${err}`
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
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  addRecord(db, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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
    const doc = db.collection(NOTIFICATIONS_COLLECTION).doc();

    if (batch) {
      batch.create(doc, data);
      return Promise.resolve(doc);
    }

    return doc.create(data);
  },

  /**
   * Lookup Firestore Notification
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} notificationId
   * @return {Promise}
   */
  findRecord(db, notificationId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    return db
      .collection(NOTIFICATIONS_COLLECTION)
      .doc(notificationId)
      .get();
  },

  /**
   * Update Firestore notification
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  updateRecord(db, notificationId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Create a Firestore notification
   * @param  {admin.firestore} db
   * @param  {String?} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, notificationId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (notificationId) {
      assert(typeof notificationId === 'string', 'has notification id');
    }
    assert(data && typeof data === 'object', 'has data');
    if (batch) {
      assert(typeof batch.create === 'function', 'has firestore batch');
    }
    notificationId =
      notificationId || db.collection(NOTIFICATIONS_COLLECTION).doc().id;
    const doc = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      return Promise.resolve(batch.create(doc, data));
    }

    return doc.create(data);
  },

  /**
   * Query all notifications
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
    }

    let fsQuery = db.collection(NOTIFICATIONS_COLLECTION);

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
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} notificationId
   * @param  {firestore.batch?} batch
   * @return {Promise} resolves {Document}
   */
  destroyRecord(db, notificationId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      notificationId && typeof notificationId === 'string',
      'has notification id'
    );
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }
    const doc = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve(doc);
    }

    return doc.delete();
  },
});
