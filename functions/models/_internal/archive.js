const assert = require('assert');
const config = require('../../config');
const modelSetup = require('../utils/model-setup');

const PREFIX = 'models: internal: archive:';
const ARCHIVE_PATH = '/archive';
const ARCHIVE_COLLECTION = 'archives';
const DEFICIENT_ITEM_PATH = config.deficientItems.dbPath;
const DEFICIENT_COLLECTION = config.deficientItems.collection;

module.exports = modelSetup({
  deficientItem: {
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
     * Remove a realtime archived record
     * @param  {firebaseadmin.database} db
     * @param  {String}  propertyId
     * @param  {String} deficientItemId
     * @return {Promise}
     */
    realtimeRemoveRecord(db, propertyId, deficientItemId) {
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
     * Recover any Firestore deficiency from archive
     * @param  {firebaseadmin.firestore} fs
     * @param  {String}  propertyId
     * @param  {String}  inspectionId
     * @param  {String}  itemId
     * @return {Promise} - resolve {Document|Object}
     */
    async firestoreFindRecord(fs, query) {
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

      if (hasDiIdentifier) {
        deficienciesRef.doc(deficientItemId);
      } else {
        deficienciesRef.where('_collection', '==', DEFICIENT_COLLECTION);
        deficienciesRef.where('property', '==', propertyId);
        deficienciesRef.where('inspection', '==', inspectionId);
        deficienciesRef.where('item', '==', itemId);
      }

      let deficiency = null;
      try {
        const deficienciesSnap = await deficienciesRef.get();
        if (deficienciesSnap.size) deficiency = deficienciesSnap.docs[0];
      } catch (err) {
        throw Error(`${PREFIX}: firestoreFindRecord: Lookup failed: ${err}`);
      }

      return deficiency;
    },

    /**
     * Remove Firestore Inspection
     * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
     * @param  {String} deficientItemId
     * @return {Promise}
     */
    firestoreRemoveRecord(fs, deficientItemId) {
      assert(
        deficientItemId && typeof deficientItemId === 'string',
        'has deficient item id'
      );
      return fs
        .collection(ARCHIVE_COLLECTION)
        .doc(deficientItemId)
        .delete();
    },

    /**
     * Create Firestore Inspection
     * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
     * @param  {String} deficientItemId
     * @param  {Object} data
     * @return {Promise}
     */
    firestoreCreateRecord(fs, deficientItemId, data) {
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
      const archiveData = { _collection: DEFICIENT_COLLECTION, ...data };
      return fs
        .collection(ARCHIVE_COLLECTION)
        .doc(deficientItemId)
        .create(archiveData);
    },
  },
});
