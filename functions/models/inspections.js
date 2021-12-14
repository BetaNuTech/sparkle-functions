const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const diModel = require('./deficient-items');
const archiveModel = require('./_internal/archive');
const inspUtils = require('../utils/inspection');
const firestoreUtils = require('../utils/firestore');
const storageApi = require('../services/storage');
const config = require('../config');

const INSPECTION_COLLECTION = config.models.collections.inspections;
const PROPERTY_COLLECTION = config.models.collections.properties;
const PREFIX = `models: ${INSPECTION_COLLECTION}:`;

module.exports = modelSetup({
  /**
   * Updates to reassign a
   * Firestore inspection to a new
   * property.  Move inspection's DIs
   * to new property as well.
   * @param {firebaseAdmin.firestore} fs - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {String} srcPropertyId
   * @param  {String} destPropertyId
   * @return {Promise}
   */
  async reassignProperty(fs, inspectionId, srcPropertyId, destPropertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(
      srcPropertyId && typeof srcPropertyId === 'string',
      'has source property id'
    );
    assert(
      destPropertyId && typeof destPropertyId === 'string',
      'has destination property id'
    );

    const batch = fs.batch();
    const inspectionsRef = fs.collection(INSPECTION_COLLECTION);
    const propertiesRef = fs.collection(PROPERTY_COLLECTION);

    // Add inspection reassign
    // to batched updates
    const inspectionDoc = inspectionsRef.doc(inspectionId);
    batch.update(inspectionDoc, { property: destPropertyId });

    // Remove inspection from source property
    batch.update(
      propertiesRef.doc(srcPropertyId),
      { [`inspections.${inspectionId}`]: FieldValue.delete() },
      { merge: true }
    );

    // Add inspection to destination property
    batch.update(
      propertiesRef.doc(destPropertyId),
      { [`inspections.${inspectionId}`]: true },
      { merge: true }
    );

    // Add each active deficient item
    // property relationship updates to batch
    try {
      const deficientItemSnap = await diModel.queryByInspection(
        fs,
        inspectionId
      );

      deficientItemSnap.docs.forEach(diDoc =>
        batch.update(diDoc.ref, { property: destPropertyId })
      );
    } catch (err) {
      throw Error(`${PREFIX} reassignProperty: failed to lookup DIs: ${err}`);
    }

    // Add each archived deficient item
    // property relationship updates to batch
    try {
      const archivedDefItemSnap = await archiveModel.deficientItem.queryByInspection(
        fs,
        inspectionId
      );
      archivedDefItemSnap.docs.forEach(diDoc =>
        batch.update(diDoc.ref, { property: destPropertyId })
      );
    } catch (err) {
      throw Error(`${PREFIX} reassignProperty: failed to lookup DIs: ${err}`);
    }

    return batch.commit();
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} db
   * @return {string}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(INSPECTION_COLLECTION).doc().id;
  },

  /**
   * Create a Firestore inspection
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} inspectionId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(fs, inspectionId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .create(data);
  },

  /**
   * Update Firestore Inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  updateRecord(fs, inspectionId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has update data');
    const docRef = fs.collection(INSPECTION_COLLECTION).doc(inspectionId);

    if (batch) {
      assert(typeof batch.update === 'function', 'has batch instance');
      return Promise.resolve(batch.update(docRef, data));
    }

    return docRef.update(data);
  },

  /**
   * Set Firestore Inspection
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @param  {Boolean} merge - deep merge record
   * @return {Promise}
   */
  setRecord(db, inspectionId, data, batch, merge = false) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');

    const docRef = db.collection(INSPECTION_COLLECTION).doc(inspectionId);
    const finalData = JSON.parse(JSON.stringify(data)); // clone
    const template = finalData.template || {};
    const deleteWrites = {};
    const itemDeletes = firestoreUtils.getDeleteWrites(
      template.items || {},
      'template.items'
    );
    const sectionDeletes = firestoreUtils.getDeleteWrites(
      template.sections || {},
      'template.sections'
    );

    // Merge all delete updates
    Object.assign(deleteWrites, itemDeletes, sectionDeletes);
    const hasDeleteWrites = isObjectEmpty(deleteWrites) === false;

    // Remove nested nulls in items and sections
    firestoreUtils.removeNulls(template.items || {});
    firestoreUtils.removeNulls(template.sections || {});

    // Remove empty section/items hashes
    // which could clear all the inspection answers
    const hasEmptyItems = isObjectEmpty((finalData.template || {}).items || {});
    const hasEmptySections = isObjectEmpty(
      (finalData.template || {}).sections || {}
    );
    if (hasEmptyItems) delete finalData.template.items;
    if (hasEmptySections) delete finalData.template.sections;

    // Remove empty template
    const hasEmptyTemplate = isObjectEmpty(finalData.template || {});
    if (hasEmptyTemplate) delete finalData.template;

    // Add batched update
    if (batch) {
      assert(
        typeof batch.set === 'function' && typeof batch.update === 'function',
        'has batch instance'
      );
      batch.set(docRef, finalData, { merge });
      if (hasDeleteWrites) batch.update(docRef, deleteWrites); // add deletes
      return Promise.resolve();
    }

    // Normal update
    return docRef.set(finalData, { merge }).then(
      () => (hasDeleteWrites ? docRef.update(deleteWrites) : Promise.resolve()) // append any deletes
    );
  },

  /**
   * Create or update a inspection
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  inspectionId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(fs, inspectionId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(INSPECTION_COLLECTION).doc(inspectionId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;
    const upsert = { ...data };
    if (data.score !== undefined) {
      upsert.score = getScore(data);
    }
    if (data.template !== undefined) {
      upsert.templateName = getTemplateName(data);
    }

    try {
      if (exists) {
        await docRef.update(upsert);
      } else {
        await docRef.create(upsert);
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
   * Lookup Firestore Property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise}
   */
  findRecord(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    return fs
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .get();
  },

  /**
   * Remove Firestore Inspection
   * by moving it to the archive
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @param  {Object?} data - inspection data
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async removeRecord(fs, inspectionId, data, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    let inspectionDocRef = null;
    let inspection = null;

    if (!data) {
      try {
        const snap = await this.findRecord(fs, inspectionId);
        inspectionDocRef = snap.ref;
        inspection = snap.data();
      } catch (err) {
        throw Error(`${PREFIX}: removeRecord: ${err}`);
      }
    } else {
      inspectionDocRef = fs.collection(INSPECTION_COLLECTION).doc(inspectionId);
      inspection = data;
    }

    if (!inspection) return; // inspection does not exist

    const batch = parentBatch || fs.batch();
    batch.delete(inspectionDocRef);

    // Add archive updates to transaction
    await archiveModel.inspection.createRecord(
      fs,
      inspectionId,
      inspection,
      batch
    );

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Delete Firestore Inspection
   * without archiving it
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  destroyRecord(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    return fs
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .delete();
  },

  /**
   * Lookup all inspections associated with a property
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {QuerySnapshot}
   */
  queryByProperty(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return fs
      .collection(INSPECTION_COLLECTION)
      .where('property', '==', propertyId)
      .get();
  },

  /**
   * Query all inspections
   * @param  {admin.firestore} fs
   * @param  {Object} query
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(fs, query, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let fsQuery = fs.collection(INSPECTION_COLLECTION);

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
      assert(typeof batch.get === 'function', 'has firestore batch');
      return Promise.resolve(batch.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Find latest completed inspection for
   * a property before a specified timestamp
   * @param  {admin.firestore} fs
   * @param  {Number} before
   * @param  {Object?} query
   * @return {Promise} - resolves {DataSnapshot}
   */
  latestCompletedQuery(fs, before, query = {}) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      typeof before === 'number' && before === before,
      'has numberic before'
    );

    let fsQuery = fs
      .collection(INSPECTION_COLLECTION)
      .orderBy('completionDate', 'desc')
      .where('completionDate', '<', before);

    if (query) {
      assert(typeof query === 'object', 'has query');

      // Append each query as where clause
      Object.keys(query).forEach(attr => {
        const queryArgs = query[attr];
        assert(
          queryArgs && Array.isArray(queryArgs),
          'has query arguments array'
        );
        fsQuery = fsQuery.where(attr, ...queryArgs);
      });
    }

    return fsQuery.limit(1).get();
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
  removeForProperty(fs, propertyId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return fs
      .runTransaction(async transaction => {
        const queryActive = fs
          .collection(INSPECTION_COLLECTION)
          .where('property', '==', propertyId);

        // Collection references to
        // all active and archived
        // inspections for the property
        let activeInspSnap = null;
        let archivedInspSnap = null;
        const inspectionRefs = [];
        try {
          [activeInspSnap, archivedInspSnap] = await Promise.all([
            transaction.get(queryActive),
            archiveModel.inspection.queryByProperty(
              fs,
              propertyId,
              transaction
            ),
          ]);
          activeInspSnap.forEach(({ ref }) => inspectionRefs.push(ref));
          archivedInspSnap.forEach(({ ref }) => inspectionRefs.push(ref));
        } catch (err) {
          throw Error(
            `${PREFIX} removeForProperty: inspection lookup failed: ${err}`
          );
        }

        // Include all deletes into batch
        const batchOrTrans = batch || transaction;
        inspectionRefs.forEach(ref => batchOrTrans.delete(ref));

        // Retuern all active/archived
        // inspection query snapshots
        return [activeInspSnap, archivedInspSnap];
      })
      .catch(err => {
        throw Error(
          `${PREFIX} removeForProperty: inspection deletes failed: ${err}`
        );
      });
  },

  /**
   * Remove all uploads for an inspection's item
   * TODO: move to inspection service
   * @param  {admin.storage} storage
   * @param  {Object} item
   * @return {Promise} - All remove requests grouped together
   */
  deleteItemUploads(storage, item) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(item && typeof item === 'object', 'has item object');

    const requests = [];
    const urls = inspUtils.getInspectionItemUploadUrls(item);

    for (let i = 0; i < urls.length; i++) {
      requests.push(storageApi.deleteInspectionItemPhoto(storage, urls[i]));
    }

    return Promise.all(requests);
  },
});

/**
 * Lookup template name inspection
 * @param  {Object} inspection
 * @return {String} - templateName
 */
function getTemplateName(inspection) {
  return inspection.templateName || inspection.template.name;
}

/**
 * Get inspection score or `0`
 * @param  {Object} inspection
 * @return {Number} - score
 */
function getScore(inspection) {
  return inspection.score && typeof inspection.score === 'number'
    ? inspection.score
    : 0;
}

/**
 * Determine if an object contains anything
 * @param  {Object} obj
 * @return {Boolean}
 */
function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}
