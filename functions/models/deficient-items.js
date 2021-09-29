const assert = require('assert');
const FieldPath = require('firebase-admin').firestore.FieldPath;
// const { FieldPath } = require('@google-cloud/firestore');
const modelSetup = require('./utils/model-setup');
const systemModel = require('./system');
const archive = require('./_internal/archive');
const config = require('../config');

const PREFIX = 'models: deficient-items:';
const DEFICIENT_COLLECTION = config.deficientItems.collection;
const STORAGE_PATH_TEMPLATE = config.deficientItems.storagePathTemplate;

module.exports = modelSetup({
  /**
   * Lookup each deficiency by id
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String[]} ids
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  findMany(fs, ...ids) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(Array.isArray(ids) && ids.length, 'has 1 or more lookup ids');
    assert(
      ids.every(id => typeof id === 'string'),
      'has array of string ids'
    );

    return fs
      .collection(DEFICIENT_COLLECTION)
      .where(FieldPath.documentId(), 'in', ids)
      .get();
  },

  /**
   * Update a deficiency's completed photo
   * trello card attachment identifier
   * @param  {admin.firestore} fs
   * @param  {String} deficiencyId
   * @param  {String} completedPhotoId
   * @param  {String} trelloAttachmentId
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Document}
   */
  async firestoreUpdateCompletedPhotoTrelloCardAttachment(
    fs,
    deficiencyId,
    completedPhotoId,
    trelloAttachmentId,
    batch
  ) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(
      completedPhotoId && typeof completedPhotoId === 'string',
      'has completed photo id'
    );
    assert(
      trelloAttachmentId && typeof trelloAttachmentId === 'string',
      'has trello attachment id'
    );
    const updatedAt = Math.round(Date.now() / 1000);

    let doc = null;
    try {
      doc = await this.firestoreUpdateRecord(
        fs,
        deficiencyId,
        {
          updatedAt,
          [`completedPhotos.${completedPhotoId}.trelloCardAttachement`]: trelloAttachmentId,
        },
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpdateCompletedPhotoTrelloCardAttachment: update failed: ${err}`
      );
    }

    return doc;
  },

  /**
   * Create a Firestore Deficient Item
   * @param  {admin.firestore} fs
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {WriteResult}
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

    const doc = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.create(doc, data);
      return Promise.resolve();
    }

    return doc.create(data);
  },

  /**
   * Create a deficiency ensuring that
   * it is not a duplicate for a matching
   * proeprty/inspection/item combination
   * @param  {admin.firestore} fs - Firestore Admin DB instance
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @return {Promise}
   */
  async firestoreSafelyCreateRecord(fs, deficiencyId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(data && typeof data === 'object', 'has record data');
    assert(data.item && typeof data.item === 'string', 'has item reference');
    assert(
      data.inspection && typeof data.inspection === 'string',
      'has inspection reference'
    );
    assert(
      data.property && typeof data.property === 'string',
      'has property reference'
    );

    let archived = null;
    let archivedId = '';
    const query = {
      propertyId: data.property,
      inspectionId: data.inspection,
      itemId: data.item,
    };

    // Recover any previously
    // archived firestore deficiency
    try {
      const archivedDoc = await archive.deficientItem.firestoreFindRecord(
        fs,
        query
      );
      archived = archivedDoc ? archivedDoc.data() : null;
      if (archived) {
        archivedId = archivedDoc.id;
        delete archived._collection; // Remove arhive only attibute
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreSafelyCreateRecord: archive lookup failed: ${err}`
      );
    }

    try {
      await fs.runTransaction(async transaction => {
        const existingQuery = fs
          .collection(DEFICIENT_COLLECTION)
          .where('property', '==', data.property)
          .where('inspection', '==', data.inspection)
          .where('item', '==', data.item);
        const existingDeficiencies = await transaction.get(existingQuery);

        if (existingDeficiencies.size === 0) {
          this.firestoreCreateRecord(
            fs,
            archivedId || deficiencyId,
            { ...data, ...archived },
            transaction
          );

          if (archived) {
            // Cleanup firestore archive
            archive.deficientItem.firestoreRemoveRecord(
              fs,
              archivedId,
              transaction
            );
          }
        }
      });
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreSafelyCreateRecord: transaction failed: ${err}`
      );
    }
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  firestoreFindRecord(fs, deficientItemId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .get();
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQueryRecords(fs, query) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query object');

    const { property, inspection, item } = query;
    assert(property && typeof property === 'string', 'has property id');
    assert(inspection && typeof inspection === 'string', 'has inspection id');
    assert(item && typeof item === 'string', 'has item id');

    return fs
      .collection(DEFICIENT_COLLECTION)
      .where('property', '==', property)
      .where('inspection', '==', inspection)
      .where('item', '==', item)
      .get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQueryByProperty(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    return colRef.where('property', '==', propertyId).get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single inspection
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQueryByInspection(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(inspectionId && typeof inspectionId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    return colRef.where('inspection', '==', inspectionId).get();
  },

  /**
   * Lookup Firestore Deficiency query
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {Object} query
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQuery(fs, query, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (batch) {
      assert(typeof batch.get === 'function', 'has firestore batch');
    }

    let fsQuery = fs.collection(DEFICIENT_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      fsQuery = fsQuery.where(attr, ...queryArgs);
    });

    if (batch) {
      return Promise.resolve(batch.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Remove Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
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
    const doc = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  firestoreUpdateRecord(fs, deficiencyId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = fs.collection(DEFICIENT_COLLECTION).doc(deficiencyId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Create/Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise}
   */
  async firestoreUpsertRecord(fs, deficientItemId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');

    const docRef = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
    }

    const { exists } = docSnap;

    try {
      if (exists) {
        await this.firestoreUpdateRecord(fs, deficientItemId, data);
      } else {
        await this.firestoreCreateRecord(fs, deficientItemId, data);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Archive a deficiency and
   * any associated Trello card
   * @param  {admin.firestore} fs
   * @param  {String}  deficiencyId
   * @return {Promise}
   */
  async firestoreDeactivateRecord(fs, deficiencyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await this.firestoreFindRecord(fs, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = fs.batch();
    const deficientItem = diDoc.data();
    deficientItem.archive = true;

    try {
      await archive.deficientItem.firestoreCreateRecord(
        fs,
        deficiencyId,
        deficientItem,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: archived DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await this.firestoreRemoveRecord(fs, deficiencyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: DI "${deficiencyId}" remove failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: batch commit failed: ${err}`
      );
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        fs,
        deficientItem.property,
        deficiencyId,
        false
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code !== 'ERR_TRELLO_CARD_DELETED') {
        const resultErr = Error(
          `${PREFIX} firestoreDeactivateRecord: failed to unarchive trello card | ${err}`
        );
        resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
        throw resultErr;
      }
    }

    return updates;
  },

  /**
   * Unarchive a previously
   * archived Firestore deficiency
   * @param  {admin.firestore} fs
   * @param  {String} deficiencyId
   * @return {Promise}
   */
  async firestoreActivateRecord(fs, deficiencyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await archive.deficientItem.firestoreFindRecord(fs, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord:  DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = fs.batch();
    const deficientItem = diDoc.data();
    delete deficientItem._collection; // Remove archive only attribute
    deficientItem.archive = false;

    try {
      await this.firestoreCreateRecord(fs, deficiencyId, deficientItem, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await archive.deficientItem.firestoreRemoveRecord(
        fs,
        deficiencyId,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: batch commit failed: ${err}`
      );
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        fs,
        deficientItem.property,
        deficiencyId,
        true
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        throw err;
      } else {
        const resultErr = Error(
          `${PREFIX} firestoreActivateRecord: failed to archive trello card | ${err}`
        );
        resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
        throw resultErr;
      }
    }

    return updates;
  },

  /**
   * Delete all inspections active
   * and archived, associated with
   * a property
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @param  {firestore.batch} batch
   * @return {Promise} - resolves {QuerySnapshot[]}
   */
  firestoreRemoveForProperty(fs, propertyId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return fs
      .runTransaction(async transaction => {
        const queryActive = fs
          .collection(DEFICIENT_COLLECTION)
          .where('property', '==', propertyId);

        // Collection references to
        // all active and archived
        // deficiencies for the property
        let activeDiSnap = null;
        let archivedDiSnap = null;
        const inspectionRefs = [];
        try {
          [activeDiSnap, archivedDiSnap] = await Promise.all([
            transaction.get(queryActive),
            archive.deficientItem.firestoreQueryByProperty(
              fs,
              propertyId,
              transaction
            ),
          ]);
          activeDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
          archivedDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
        } catch (err) {
          throw Error(
            `${PREFIX} firestoreRemoveForProperty: deficiency lookup failed: ${err}`
          );
        }

        // Include all deletes into batch
        const batchOrTrans = batch || transaction;
        inspectionRefs.forEach(ref => batchOrTrans.delete(ref));

        // Retuern all active/archived
        // deficiency query snapshots
        return [activeDiSnap, archivedDiSnap];
      })
      .catch(err => {
        throw Error(
          `${PREFIX} firestoreRemoveForProperty: deficiency deletes failed: ${err}`
        );
      });
  },

  /**
   * Delete a deficiency's image uploads
   * TODO: Move to deficiency service
   * @param  {admin.storage} storage
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @param  {String} url
   * @return {Promise}
   */
  deleteUpload(storage, propertyId, deficiencyId, url) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(url && typeof url === 'string', 'has url string');

    const fileName = (decodeURIComponent(url).split('?')[0] || '')
      .split('/')
      .pop();
    const filePath = STORAGE_PATH_TEMPLATE.replace('{{propertyId}}', propertyId)
      .replace('{{deficiencyId}}', deficiencyId)
      .replace('{{fileName}}', fileName);

    return storage
      .bucket()
      .file(filePath)
      .delete()
      .catch(err => Promise.reject(Error(`${PREFIX} deleteUpload: ${err}`)));
  },

  /**
   * Generate a Firestore ID for deficiency collection
   * @param  {admin.firestore} fs
   * @return {String} - id
   */
  uuid(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(DEFICIENT_COLLECTION).doc().id;
  },
});
