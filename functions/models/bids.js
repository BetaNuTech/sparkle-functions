const assert = require('assert');
const config = require('../config');
const modelSetup = require('./utils/model-setup');

const JOB_COLLECTION = config.models.collections.jobs;
const BID_COLLECTION = config.models.collections.bids;
const PREFIX = 'models: bids:';

module.exports = modelSetup({
  /**
   * Create a Firestore bid
   * @param  {admin.firestore} db
   * @param  {String?} bidId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, bidId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (bidId) assert(typeof bidId === 'string', 'has valid bid id');
    assert(data && typeof data === 'object', 'has data');
    assert(data.job && data.job.id, 'has firestore bid document reference');
    if (bidId === undefined) bidId = db.collection(BID_COLLECTION).doc().id;

    return db
      .collection(BID_COLLECTION)
      .doc(bidId)
      .create(data);
  },
  /**
   * Create a firestore document reference
   * @param  {admin.firestore} db
   * @param  {String} id
   * @return {firestore.DocumentReference}
   */
  createJobDocRef(db, id) {
    assert(id && typeof id === 'string', 'has document reference id');
    return db.collection(JOB_COLLECTION).doc(id);
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} db
   * @return {String}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(BID_COLLECTION).doc().id;
  },

  /**
   * Lookup Firestore bid
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} bidId
   * @return {Promise}
   */

  findRecord(db, bidId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(bidId && typeof bidId === 'string', 'has bid id');
    return db
      .collection(BID_COLLECTION)
      .doc(bidId)
      .get();
  },

  /**
   * Update Firestore Bid
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} bidId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  updateRecord(db, bidId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(bidId && typeof bidId === 'string', 'has bid id');
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = db.collection(BID_COLLECTION).doc(bidId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return batch.commit();
  },

  /**
   * Lookup a job's approved bid
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} jobId
   * @return {Promise} - resolves {QuerySnapshot}
   */
  queryJobsApproved(db, jobId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    return db
      .collection(BID_COLLECTION)
      .where('job', '==', jobId)
      .where('state', '==', 'approved')
      .get();
  },

  /**
   * Deleting all the bids linked with the current Job
   * @param  {firebaseAdmin.firestore} db Firestore DB instance
   * @param  {string} jobId , job id
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async deleteLinkedJobsRecord(db, jobId, parentBatch) {
    const jobDoc = this.createJobDocRef(db, jobId);
    const queryRef = db.collection(BID_COLLECTION).where('job', '==', jobDoc);
    const batch = parentBatch || db.batch();

    let querySnapshot;
    try {
      querySnapshot = await queryRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} deleteLinkedJobsRecord: delete bid failed with query lookup failed: ${err}`
      );
    }

    querySnapshot.forEach(function(doc) {
      batch.delete(doc.ref);
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },
});
