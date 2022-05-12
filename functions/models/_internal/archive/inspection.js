const assert = require('assert');
const modelSetup = require('../../utils/model-setup');

// const PREFIX = 'models: internal: archive: inspection:';
const ARCHIVE_COLLECTION = 'archives';
const INSPECTION_COLLECTION = 'inspections';

module.exports = modelSetup({
  /**
   * Find an archived inspection
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolve {Document}
   */
  findRecord(db, inspectionId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    return db
      .collection(ARCHIVE_COLLECTION)
      .doc(inspectionId)
      .get();
  },

  /**
   * Create a firestore inspection archive
   * or append an update to batch transaction
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} inspectionId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolve {CollectionReference}
   */
  createRecord(db, inspectionId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has data object');

    const result = { ...data, _collection: INSPECTION_COLLECTION };
    const ref = db.collection(ARCHIVE_COLLECTION).doc(inspectionId);

    // Append batch write
    if (batch) {
      assert(typeof batch.set === 'function', 'has firestore.batch instance');
      batch.set(ref, result);
      return Promise.resolve(ref);
    }

    // Normal write
    return ref.set(result);
  },

  /**
   * Lookup all archived inspections
   * associated with a property
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {QuerySnapshot}
   */
  queryByProperty(db, propertyId, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const query = db
      .collection(ARCHIVE_COLLECTION)
      .where('property', '==', propertyId)
      .where('_collection', '==', INSPECTION_COLLECTION);

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return transaction.get(query);
    }

    return query.get(query);
  },
});
