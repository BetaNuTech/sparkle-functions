const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const BID_COLLECTION = 'bids';

module.exports = modelSetup({
  /**
   * Create a Firestore bid
   * @param  {admin.firestore} fs
   * @param  {String?} bidId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(fs, bidId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (bidId) assert(typeof bidId === 'string', 'has valid bid id');
    assert(data && typeof data === 'object', 'has data');
    assert(data.job && data.bid.id, 'has firestore bid document reference');
    if (bidId === undefined) bidId = fs.collection(BID_COLLECTION).doc().id;

    return fs
      .collection(BID_COLLECTION)
      .doc(bidId)
      .create(data);
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} fs
   * @return {String}
   */
  createId(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(BID_COLLECTION).doc().id;
  },

  /**
   * Lookup Firestore bid
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} bidId
   * @return {Promise}
   */

  findRecord(fs, bidId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(bidId && typeof bidId === 'string', 'has bid id');
    return fs
      .collection(BID_COLLECTION)
      .doc(bidId)
      .get();
  },

  /**
   * Update Firestore Bid
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} bidId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  updateRecord(fs, bidId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(bidId && typeof bidId === 'string', 'has bid id');
    assert(data && typeof data === 'object', 'has update data');
    const batch = fs.batch();

    const doc = fs.collection(BID_COLLECTION).doc(bidId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return batch.commit();
  },

  /**
   * Lookup approved bid
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} jobId
   * @return {Promise}
   */

  queryJobsApproved(fs, jobId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    return fs
      .collection(BID_COLLECTION)
      .where('job', '==', jobId)
      .where('state', '==', 'approved')
      .get();
  },
});
