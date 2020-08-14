const assert = require('assert');
const config = require('../../../config');
const modelSetup = require('../../utils/model-setup');

const PREFIX = 'models: internal: archive:';
const ARCHIVE_COLLECTION = 'archives';
const DEFICIENT_COLLECTION = config.deficientItems.collection;

module.exports = modelSetup({
  /**
   * Recover any Firestore deficiency from archive
   * @param  {firebaseadmin.firestore} fs
   * @param  {String}  propertyId
   * @param  {String}  inspectionId
   * @param  {String}  itemId
   * @return {Promise} - resolve {Document|Object}
   */
  async firestoreFindRecord(fs, query) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(Boolean(query), 'has string/object query');
    let propertyId = '';
    let inspectionId = '';
    let itemId = '';
    let deficientItemId = '';
    const hasDiIdentifier = typeof query === 'string';

    if (hasDiIdentifier) {
      deficientItemId = query;
    } else {
      propertyId = query.propertyId;
      inspectionId = query.inspectionId;
      itemId = query.itemId;
      assert(
        propertyId && typeof propertyId === 'string',
        'has property reference'
      );
      assert(
        inspectionId && typeof inspectionId === 'string',
        'has inspection reference'
      );
      assert(itemId && typeof itemId === 'string', 'has item reference');
    }

    const deficienciesRef = fs.collection(ARCHIVE_COLLECTION);

    let deficiency = null;
    try {
      if (hasDiIdentifier) {
        deficiency = await deficienciesRef.doc(deficientItemId).get();
      } else {
        const deficienciesSnap = await deficienciesRef
          .where('_collection', '==', DEFICIENT_COLLECTION)
          .where('property', '==', propertyId)
          .where('inspection', '==', inspectionId)
          .where('item', '==', itemId)
          .get();
        if (deficienciesSnap.size) deficiency = deficienciesSnap.docs[0];
      }
    } catch (err) {
      throw Error(`${PREFIX}: firestoreFindRecord: Lookup failed: ${err}`);
    }

    return deficiency;
  },

  /**
   * Remove Firestore Inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, deficientItemId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );

    const doc = fs.collection(ARCHIVE_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Create Firestore Inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data,
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreCreateRecord(fs, deficientItemId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has data');
    assert(
      data.property && typeof data.property === 'string',
      'data has property id'
    );
    assert(
      data.inspection && typeof data.inspection === 'string',
      'data has inspection id'
    );
    assert(data.item && typeof data.item === 'string', 'data has item id');

    // Add collection name to archive record
    const archiveData = {
      ...data,
      _collection: DEFICIENT_COLLECTION,
      archive: true,
    };
    const doc = fs.collection(ARCHIVE_COLLECTION).doc(deficientItemId);

    // Add create to batch write
    if (batch) {
      batch.create(doc, archiveData);
      return Promise.resolve();
    }

    return doc.create(archiveData);
  },

  /**
   * Update Archived Firestore Deficient Item
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreUpdateRecord(fs, deficientItemId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = fs.collection(ARCHIVE_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve();
    }

    return doc.update(data);
  },

  /**
   * Lookup all archived inspections
   * belonging to an inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolve {Document|Object}
   */
  firestoreQueryByInspection(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    const colRef = fs.collection(ARCHIVE_COLLECTION);
    return colRef
      .where('_collection', '==', DEFICIENT_COLLECTION)
      .where('inspection', '==', inspectionId)
      .get();
  },

  /**
   * Lookup all archived deficiencies
   * associated with a property
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {QuerySnapshot}
   */
  firestoreQueryByProperty(fs, propertyId, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const query = fs
      .collection(ARCHIVE_COLLECTION)
      .where('property', '==', propertyId)
      .where('_collection', '==', DEFICIENT_COLLECTION);

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return Promise.resolve(transaction.get(query));
    }

    return query.get(query);
  },
});
