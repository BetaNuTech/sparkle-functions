const assert = require('assert');
const config = require('../config');
const modelSetup = require('./utils/model-setup');
const bidsModel = require('./bids');

const JOB_COLLECTION = config.models.collections.jobs;
const BID_COLLECTION = config.models.collections.bids;
const PROPERTY_COLLECTION = config.models.collections.properties;
const PREFIX = 'models: jobs:';

module.exports = modelSetup({
  /**
   * Create a Firestore job
   * @param  {admin.firestore} db
   * @param  {String?} jobId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, jobId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (jobId) assert(typeof jobId === 'string', 'has valid job id');
    assert(data && typeof data === 'object', 'has data');
    assert(
      data.property && data.property.id,
      'has firestore property document reference'
    );
    if (jobId === undefined) jobId = db.collection(JOB_COLLECTION).doc().id;

    return db
      .collection(JOB_COLLECTION)
      .doc(jobId)
      .create(data);
  },

  /**
   * Lookup Firestore Job
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} jobId
   * @return {Promise}
   */
  findRecord(db, jobId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    return db
      .collection(JOB_COLLECTION)
      .doc(jobId)
      .get();
  },

  /**
   * Create a firestore document reference
   * @param  {admin.firestore} db
   * @param  {String} id
   * @return {firestore.DocumentReference}
   */
  createDocRef(db, id) {
    assert(id && typeof id === 'string', 'has document reference id');
    return db.collection(JOB_COLLECTION).doc(id);
  },

  /**
   * Create a firestore document reference for property
   * @param  {admin.firestore} db
   * @param  {String} id
   * @return {firestore.DocumentReference}
   */
  createPropertyDocRef(db, id) {
    assert(id && typeof id === 'string', 'has document reference id');
    return db.collection(PROPERTY_COLLECTION).doc(id);
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} db
   * @return {string}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(JOB_COLLECTION).doc().id;
  },

  /**
   * Lookup associated bids
   * @param  {firebaseAdmin.firestore} db
   * @param  {firestore.DocumentReference} jobRef
   * @return {Promise} - resolves {QuerySnapshot}
   */
  findAssociatedBids(db, jobRef) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(jobRef && typeof jobRef === 'object', 'has job document refrence');
    return db
      .collection(BID_COLLECTION)
      .where('job', '==', jobRef)
      .get();
  },

  /**
   * Update Firestore Job
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} jobId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  updateRecord(db, jobId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(jobId && typeof jobId === 'string', 'has job id');
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = db.collection(JOB_COLLECTION).doc(jobId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Removing Job linked with the property and internally calling another function to remove bids linked witht the job.
   * @param   {firebaseAdmin.firestore} db Firestore DB instance
   * @param   {String} propertyId
   * @param   {firestore.batch?} parentBatch
   * @returns {Promise}
   */
  async deletePropertyJobAndBids(db, propertyId, parentBatch) {
    const propertyDoc = this.createPropertyDocRef(db, propertyId);

    // Lookup all property's jobs
    let linkedJobs;
    try {
      linkedJobs = await db
        .collection(JOB_COLLECTION)
        .where('property', '==', propertyDoc)
        .get();
    } catch (err) {
      throw Error(
        `${PREFIX} deletePropertyJobAndBids: failed to lookup jobs: ${err}`
      );
    }

    const batch = parentBatch || db.batch();
    const jobIds = linkedJobs.docs.map(jobDoc => {
      batch.delete(jobDoc.ref); // add job delete to batch
      return jobDoc.id;
    });

    // Delete each jobs bids
    try {
      await Promise.all(
        jobIds.map(jobId => bidsModel.deleteLinkedJobsRecord(db, jobId, batch))
      );
    } catch (err) {
      throw Error(
        `${PREFIX} deletePropertyJobAndBids: failed to delete bids: ${err}`
      );
    }

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },
});
