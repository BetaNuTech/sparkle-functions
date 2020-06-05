const assert = require('assert');
const config = require('../../../config');
const modelSetup = require('../../utils/model-setup');

const PREFIX = 'models: internal: archive:';
const ARCHIVE_PATH = '/archive';
const ARCHIVE_COLLECTION = 'archives';
const DEFICIENT_ITEM_PATH = config.deficientItems.dbPath;
const DEFICIENT_COLLECTION = config.deficientItems.collection;

module.exports = modelSetup({
  /**
   * Find a realtime archived Deficient Item (by ID)
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DatabaseRef}
   */
  findRecord(db, propertyId, deficientItemId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    return db
      .ref(
        `${ARCHIVE_PATH}${DEFICIENT_ITEM_PATH}/${propertyId}/${deficientItemId}`
      )
      .once('value');
  },

  /**
   * Recover any deficient item from archive
   * matching a property's inspection item
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyId
   * @param  {String}  inspectionId
   * @param  {String}  itemId
   * @return {Promise} - resolve {DataSnapshot|Object}
   */
  async realtimeFindRecord(db, { propertyId, inspectionId, itemId }) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      propertyId && typeof propertyId === 'string',
      'has property reference'
    );
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection reference'
    );
    assert(itemId && typeof itemId === 'string', 'has item reference');

    let result = null;
    const archPropertyDiRef = db.ref(
      `archive${DEFICIENT_ITEM_PATH}/${propertyId}`
    );
    const deficientItemSnaps = await archPropertyDiRef
      .orderByChild('item')
      .equalTo(itemId)
      .once('value');

    // Find DI's matching inspection ID
    // (we've matched or property and item already)
    deficientItemSnaps.forEach(deficientItemSnap => {
      if (!result && deficientItemSnap.val().inspection === inspectionId) {
        result = deficientItemSnap;
      }
    });

    return result;
  },

  /**
   * Create a realtime archived Deficient Item
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise} - resolves {DatabaseRef}
   */
  realtimeCreateRecord(db, propertyId, deficientItemId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      propertyId && typeof propertyId === 'string',
      'has property reference'
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has property reference'
    );
    assert(data && typeof data === 'object', 'has deficient item data');
    const ref = db.ref(
      `${ARCHIVE_PATH}${DEFICIENT_ITEM_PATH}/${propertyId}/${deficientItemId}`
    );
    return ref.set({ ...data, archive: true }).then(() => ref);
  },

  /**
   * Remove a realtime archived record
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyId
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, propertyId, deficientItemId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );

    return db
      .ref(
        `${ARCHIVE_PATH}${DEFICIENT_ITEM_PATH}/${propertyId}/${deficientItemId}`
      )
      .remove();
  },

  /**
   * Find all archived deficient items
   * associated with an inspection
   * @param  {admin.database}  db
   * @param  {String}  inspectionId
   * @return {Promise} - resolves {Object}
   */
  async findAllByInspection(db, inspectionId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    const result = [];
    const deficientItemsByPropertySnap = await db
      .ref(`${ARCHIVE_PATH}${DEFICIENT_ITEM_PATH}`)
      .once('value');

    // Add each DI belonging to an inspection to result
    deficientItemsByPropertySnap.forEach(propertyDeficientItemsSnap => {
      propertyDeficientItemsSnap.forEach(deficientItemsSnap => {
        try {
          if (deficientItemsSnap.val().inspection === inspectionId) {
            result.push(deficientItemsSnap);
          }
        } catch (e) {} // eslint-disable-line no-empty
      });
    });

    return result;
  },

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
   * @return {Promise}
   */
  firestoreUpdateRecord(fs, deficientItemId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');
    return fs
      .collection(ARCHIVE_COLLECTION)
      .doc(deficientItemId)
      .update(data);
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
      return transaction.get(query);
    }

    return query.get(query);
  },
});
