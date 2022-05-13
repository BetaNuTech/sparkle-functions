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
   * @param  {firebaseAdmin.firestore} db
   * @param  {String[]} ids
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  findMany(db, ...ids) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(Array.isArray(ids) && ids.length, 'has 1 or more lookup ids');
    assert(
      ids.every(id => typeof id === 'string'),
      'has array of string ids'
    );

    return db
      .collection(DEFICIENT_COLLECTION)
      .where(FieldPath.documentId(), 'in', ids)
      .get();
  },

  /**
   * Update a deficiency's completed photo
   * trello card attachment identifier
   * @param  {admin.firestore} db
   * @param  {String} deficiencyId
   * @param  {String} completedPhotoId
   * @param  {String} trelloAttachmentId
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Document}
   */
  async updateCompletedPhotoTrelloCardAttachment(
    db,
    deficiencyId,
    completedPhotoId,
    trelloAttachmentId,
    batch
  ) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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
      doc = await this.updateRecord(
        db,
        deficiencyId,
        {
          updatedAt,
          [`completedPhotos.${completedPhotoId}.trelloCardAttachement`]: trelloAttachmentId,
        },
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} updateCompletedPhotoTrelloCardAttachment: update failed: ${err}`
      );
    }

    return doc;
  },

  /**
   * Create a Firestore Deficient Item
   * @param  {admin.firestore} db
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, deficientItemId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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

    const doc = db.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

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
   * @param  {admin.firestore} db - Firestore Admin DB instance
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @return {Promise}
   */
  async safelyCreateRecord(db, deficiencyId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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
      const archivedDoc = await archive.deficientItem.findRecord(db, query);
      archived = archivedDoc ? archivedDoc.data() : null;
      if (archived) {
        archivedId = archivedDoc.id;
        delete archived._collection; // Remove arhive only attibute
      }
    } catch (err) {
      throw Error(
        `${PREFIX} safelyCreateRecord: archive lookup failed: ${err}`
      );
    }

    try {
      await db.runTransaction(async transaction => {
        const existingQuery = db
          .collection(DEFICIENT_COLLECTION)
          .where('property', '==', data.property)
          .where('inspection', '==', data.inspection)
          .where('item', '==', data.item);
        const existingDeficiencies = await transaction.get(existingQuery);

        if (existingDeficiencies.size === 0) {
          this.createRecord(
            db,
            archivedId || deficiencyId,
            { ...data, ...archived },
            transaction
          );

          if (archived) {
            // Cleanup firestore archive
            archive.deficientItem.removeRecord(db, archivedId, transaction);
          }
        }
      });
    } catch (err) {
      throw Error(`${PREFIX} safelyCreateRecord: transaction failed: ${err}`);
    }
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  findRecord(db, deficientItemId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    return db
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .get();
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DataSnapshot}
   */
  queryRecords(db, query) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query object');

    const { property, inspection, item } = query;
    assert(property && typeof property === 'string', 'has property id');
    assert(inspection && typeof inspection === 'string', 'has inspection id');
    assert(item && typeof item === 'string', 'has item id');

    return db
      .collection(DEFICIENT_COLLECTION)
      .where('property', '==', property)
      .where('inspection', '==', inspection)
      .where('item', '==', item)
      .get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single property
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  queryByProperty(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const colRef = db.collection(DEFICIENT_COLLECTION);
    return colRef.where('property', '==', propertyId).get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single inspection
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  queryByInspection(db, inspectionId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(inspectionId && typeof inspectionId === 'string', 'has property id');
    const colRef = db.collection(DEFICIENT_COLLECTION);
    return colRef.where('inspection', '==', inspectionId).get();
  },

  /**
   * Lookup Firestore Deficiency query
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {Object} query
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  query(db, query, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (batch) {
      assert(typeof batch.get === 'function', 'has firestore batch');
    }

    let dbQuery = db.collection(DEFICIENT_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      dbQuery = dbQuery.where(attr, ...queryArgs);
    });

    if (batch) {
      return Promise.resolve(batch.get(dbQuery));
    }

    return dbQuery.get(query);
  },

  /**
   * Remove Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  removeRecord(db, deficientItemId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    const doc = db.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @param  {firestore.batch?}
   * @return {Promise} - resolves {Document}
   */
  updateRecord(db, deficiencyId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = db.collection(DEFICIENT_COLLECTION).doc(deficiencyId);

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Create/Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise}
   */
  async upsertRecord(db, deficientItemId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');

    const docRef = db.collection(DEFICIENT_COLLECTION).doc(deficientItemId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;

    try {
      if (exists) {
        await this.updateRecord(db, deficientItemId, data);
      } else {
        await this.createRecord(db, deficientItemId, data);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} upsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Archive a deficiency and
   * any associated Trello card
   * @param  {admin.firestore} db
   * @param  {String}  deficiencyId
   * @return {Promise}
   */
  async deactivateRecord(db, deficiencyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await this.findRecord(db, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} deactivateRecord: DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = db.batch();
    const deficientItem = diDoc.data();
    deficientItem.archive = true;

    try {
      await archive.deficientItem.createRecord(
        db,
        deficiencyId,
        deficientItem,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} deactivateRecord: archived DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await this.removeRecord(db, deficiencyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} deactivateRecord: DI "${deficiencyId}" remove failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} deactivateRecord: batch commit failed: ${err}`);
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        db,
        deficientItem.property,
        deficiencyId,
        false
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code !== 'ERR_TRELLO_CARD_DELETED') {
        const resultErr = Error(
          `${PREFIX} deactivateRecord: failed to unarchive trello card | ${err}`
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
   * @param  {admin.firestore} db
   * @param  {String} deficiencyId
   * @return {Promise}
   */
  async activateRecord(db, deficiencyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await archive.deficientItem.findRecord(db, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} activateRecord:  DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = db.batch();
    const deficientItem = diDoc.data();
    delete deficientItem._collection; // Remove archive only attribute
    deficientItem.archive = false;

    try {
      await this.createRecord(db, deficiencyId, deficientItem, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} activateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await archive.deficientItem.removeRecord(db, deficiencyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} activateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} activateRecord: batch commit failed: ${err}`);
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        db,
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
          `${PREFIX} activateRecord: failed to archive trello card | ${err}`
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
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @param  {firestore.batch} batch
   * @return {Promise} - resolves {QuerySnapshot[]}
   */
  removeForProperty(db, propertyId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return db
      .runTransaction(async transaction => {
        const queryActive = db
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
            archive.deficientItem.queryByProperty(db, propertyId, transaction),
          ]);
          activeDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
          archivedDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
        } catch (err) {
          throw Error(
            `${PREFIX} removeForProperty: deficiency lookup failed: ${err}`
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
          `${PREFIX} removeForProperty: deficiency deletes failed: ${err}`
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
   * @param  {admin.firestore} db
   * @return {String} - id
   */
  uuid(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(DEFICIENT_COLLECTION).doc().id;
  },
});
