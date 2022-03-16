const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const diModel = require('./deficient-items');
const archiveModel = require('./_internal/archive');
const firestoreUtils = require('../utils/firestore');
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
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @param  {String} srcPropertyId
   * @param  {String} destPropertyId
   * @return {Promise}
   */
  async reassignProperty(db, inspectionId, srcPropertyId, destPropertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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

    const batch = db.batch();
    const inspectionsRef = db.collection(INSPECTION_COLLECTION);
    const propertiesRef = db.collection(PROPERTY_COLLECTION);

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
        db,
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
        db,
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
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, inspectionId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .create(data);
  },

  /**
   * Update Firestore Inspection
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  updateRecord(db, inspectionId, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has update data');
    const docRef = db.collection(INSPECTION_COLLECTION).doc(inspectionId);

    if (batch) {
      assert(typeof batch.update === 'function', 'has batch instance');
      return Promise.resolve(batch.update(docRef, data));
    }

    return docRef.update(data);
  },

  /**
   * Set Firestore Inspection
   * @param  {admin.firestore} db
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
      'has inspectioin id'
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
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(db, inspectionId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = db.collection(INSPECTION_COLLECTION).doc(inspectionId);
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
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @return {Promise}
   */
  findRecord(db, inspectionId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    return db
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .get();
  },

  /**
   * Remove Firestore Inspection
   * by moving it to the archive
   * @param  {admin.firestore} db
   * @param  {String} inspectionId
   * @param  {Object?} data - inspection data
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  async removeRecord(db, inspectionId, data, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    let inspectionDocRef = null;
    let inspection = null;

    if (!data) {
      try {
        const snap = await this.findRecord(db, inspectionId);
        inspectionDocRef = snap.ref;
        inspection = snap.data();
      } catch (err) {
        throw Error(`${PREFIX}: removeRecord: ${err}`);
      }
    } else {
      inspectionDocRef = db.collection(INSPECTION_COLLECTION).doc(inspectionId);
      inspection = data;
    }

    if (!inspection) return; // inspection does not exist

    const batch = parentBatch || db.batch();
    batch.delete(inspectionDocRef);

    // Add archive updates to transaction
    await archiveModel.inspection.createRecord(
      db,
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
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @return {Promise}
   */
  destroyRecord(db, inspectionId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    return db
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .delete();
  },

  /**
   * Lookup all inspections associated with a property
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @return {Promise} - resolves {QuerySnapshot}
   */
  queryByProperty(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(INSPECTION_COLLECTION)
      .where('property', '==', propertyId)
      .get();
  },

  /**
   * Query all inspections
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let dbQuery = db.collection(INSPECTION_COLLECTION);

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
      assert(typeof batch.get === 'function', 'has firestore batch');
      return Promise.resolve(batch.get(dbQuery));
    }

    return dbQuery.get(query);
  },

  /**
   * Find latest completed inspection for
   * a property before a specified timestamp
   * @param  {admin.firestore} db
   * @param  {Number} before
   * @param  {Object?} query
   * @return {Promise} - resolves {DataSnapshot}
   */
  latestCompletedQuery(db, before, query = {}) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      typeof before === 'number' && before === before,
      'has numberic before'
    );

    let dbQuery = db
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
        dbQuery = dbQuery.where(attr, ...queryArgs);
      });
    }

    return dbQuery.limit(1).get();
  },

  /**
   * Delete all inspections active
   * and archived, associated with
   * a property
   * @param  {admin.firestore} db
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
              db,
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
