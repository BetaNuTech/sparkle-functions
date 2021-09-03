const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const JOB_COLLECTION = 'jobs';
const BID_COLLECTION = 'bids';

module.exports = modelSetup({
  /**
   * Create a Firestore job
   * @param  {admin.firestore} fs
   * @param  {String?} jobId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(fs, jobId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (jobId) assert(typeof jobId === 'string', 'has valid job id');
    assert(data && typeof data === 'object', 'has data');
    assert(
      data.property && data.property.id,
      'has firestore property document reference'
    );
    if (jobId === undefined) jobId = fs.collection(JOB_COLLECTION).doc().id;

    return fs
      .collection(JOB_COLLECTION)
      .doc(jobId)
      .create(data);
  },

  /**
   * Lookup Firestore Job
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} jobId
   * @return {Promise}
   */
  findRecord(fs, jobId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    return fs
      .collection(JOB_COLLECTION)
      .doc(jobId)
      .get();
  },
  /**
   * Create a firestore document reference
   * @param  {admin.firestore} fs
   * @param  {String} id
   * @return {firestore.DocumentReference}
   */
  createDocRef(fs, id) {
    assert(id && typeof id === 'string', 'has document reference id');
    return fs.collection(JOB_COLLECTION).doc(id);
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} fs
   * @return {Promise}
   */
  createId(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(JOB_COLLECTION).doc().id;
  },

  /**
   * Lookup associated bids
   * @param  {firebaseAdmin.firestore} fs
   * @param  {firestore.DocumentReference} jobRef
   * @return {Promise} - resolves {QuerySnapshot}
   */
  findAssociatedBids(fs, jobRef) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(jobRef && typeof jobRef === 'object', 'has job document refrence');
    return fs
      .collection(BID_COLLECTION)
      .where('job', '==', jobRef)
      .get();
  },

  /**
   * Update Firestore Job
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} jobId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  updateRecord(fs, jobId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = fs.collection(JOB_COLLECTION).doc(jobId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },
});
