const assert = require('assert');
const modelSetup = require('../../utils/model-setup');

// const PREFIX = 'models: internal: archive: inspection:';
const ARCHIVE_PATH = '/archive';
const ARCHIVE_COLLECTION = 'archives';
const INSPECTIONS_PATH = '/inspections';
const INSPECTION_COLLECTION = 'inspections';

module.exports = modelSetup({
  /**
   * Find inspection by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  realtimeFindRecord(db, inspectionId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    return db
      .ref(`${ARCHIVE_PATH}${INSPECTIONS_PATH}/${inspectionId}`)
      .once('value');
  },

  /**
   * Find an archived inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolve {Document}
   */
  firestoreFindRecord(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    return fs
      .collection(ARCHIVE_COLLECTION)
      .doc(inspectionId)
      .get();
  },

  /**
   * Create a firestore inspection archive
   * or append an update to batch transaction
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolve {CollectionReference}
   */
  firestoreCreateRecord(fs, inspectionId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has data object');

    const result = { ...data, _collection: INSPECTION_COLLECTION };
    const ref = fs.collection(ARCHIVE_COLLECTION).doc(inspectionId);

    // Append batch write
    if (batch) {
      assert(typeof batch.set === 'function', 'has firestore.batch instance');
      batch.set(ref, result);
      return Promise.resolve(ref);
    }

    // Normal write
    return ref.set(result);
  },
});
