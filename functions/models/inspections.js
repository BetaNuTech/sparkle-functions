const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const diModel = require('./deficient-items');
const archiveModel = require('./_internal/archive');
const deleteUploads = require('../inspections/utils/delete-uploads');
const itemUploads = require('../inspections/utils/item-uploads');

const PREFIX = 'models: inspections:';
const INSPECTIONS_PATH = '/inspections';
const INSPECTION_COLLECTION = 'inspections';
const PROPERTY_COLLECTION = 'properties';
const INSPECTION_REPORT_STATUSES = [
  'generating',
  'completed_success',
  'completed_failure',
];

module.exports = modelSetup({
  /**
   * Find inspection by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  findRecord(db, inspectionId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    return db.ref(`${INSPECTIONS_PATH}/${inspectionId}`).once('value');
  },

  /**
   * Add/update Realtime Inspection
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} inspectionId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, inspectionId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(data && typeof data === 'object', 'has upsert data');
    return db.ref(`${INSPECTIONS_PATH}/${inspectionId}`).update(data);
  },

  /**
   * Remove inspection by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, inspectionId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(inspectionId && typeof inspectionId === 'string', 'has property id');
    return db.ref(`${INSPECTIONS_PATH}/${inspectionId}`).remove();
  },

  /**
   * Lookup single deficient item
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  findItem(db, inspectionId, itemId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(itemId && typeof itemId === 'string', 'has inspection item id');
    return db
      .ref(`${INSPECTIONS_PATH}/${inspectionId}/template/items/${itemId}`)
      .once('value');
  },

  /**
   * Query all inspections belonging to a property
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DataSnapshot} inspections snapshot
   */
  queryByProperty(db, propertyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .ref(INSPECTIONS_PATH)
      .orderByChild('property')
      .equalTo(propertyId)
      .once('value');
  },

  /**
   * Set/update inspections PDF report status
   * @param {admin.database} db - Firebase Admin DB instance
   * @param {admin.firestore} fs - Firestore Admin DB instance
   * @param {String} inspectionId
   * @param {String} status
   * @return {Promise}
   */
  async setPDFReportStatus(db, fs, inspectionId, status) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(
      INSPECTION_REPORT_STATUSES.includes(status),
      'has valid PDF inspection report status'
    );

    try {
      await db
        .ref(`${INSPECTIONS_PATH}/${inspectionId}/inspectionReportStatus`)
        .set(status);
    } catch (err) {
      throw Error(
        `${PREFIX} setPDFReportStatus: failed to update Firebase status: ${err}`
      );
    }

    try {
      await this.firestoreUpsertRecord(fs, inspectionId, {
        inspectionReportStatus: status,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} setPDFReportStatus: failed to update Firestore status: ${err}`
      );
    }
  },

  /**
   * Set/update inspections PDF report url
   * @param {admin.database} db - Firebase Admin DB instance
   * @param {admin.firestore} fs - Firestore Admin DB instance
   * @param {String} inspectionId
   * @param {String} url
   * @return {Promise}
   */
  async setReportURL(db, fs, inspectionId, url) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(url && typeof url === 'string', 'has report url');

    try {
      await db
        .ref(`${INSPECTIONS_PATH}/${inspectionId}/inspectionReportURL`)
        .set(url);
    } catch (err) {
      throw Error(
        `${PREFIX} setReportURL: Failed to update firebase inspection: ${err}`
      );
    }

    try {
      await this.firestoreUpsertRecord(fs, inspectionId, {
        inspectionReportURL: url,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} setReportURL: Failed to update firestore inspection: ${err}`
      );
    }
  },

  /**
   * Update inspections PDF report UNIX timestamp to now
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param {String} inspectionId
   * @return {Promise}
   */
  async updatePDFReportTimestamp(db, fs, inspectionId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    const now = Math.round(Date.now() / 1000);

    try {
      await db
        .ref(
          `${INSPECTIONS_PATH}/${inspectionId}/inspectionReportUpdateLastDate`
        )
        .set(now);
    } catch (err) {
      throw Error(
        `${PREFIX} updatePDFReportTimestamp: failed to update firebase: ${err}`
      );
    }

    try {
      await this.firestoreUpsertRecord(fs, inspectionId, {
        inspectionReportUpdateLastDate: now,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} updatePDFReportTimestamp: failed to update firestore: ${err}`
      );
    }
  },

  /**
   * Write/remove an Inspection's completed
   * inspection proxy
   * @param  {firebaseAdmin.database} db
   * @param  {String} inspectionId
   * @param  {Object} inspection
   * @param  {Object?} options
   * @return {Promise} - resolves {Object} completed inspection proxy
   */
  async syncCompletedInspectionProxy(
    db,
    inspectionId,
    inspection,
    options = {}
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection ID'
    );
    assert(Boolean(inspection), 'has inspection data');

    const updates = {};
    const { dryRun = false } = options;
    const proxyPath = `/completedInspectionsList/${inspectionId}`;
    let completedInspectionData = null;

    if (!inspection.inspectionCompleted) {
      updates[proxyPath] = null;

      if (!dryRun) {
        try {
          await db.ref(proxyPath).remove();
        } catch (err) {
          throw Error(
            `${PREFIX} syncCompletedInspectionProxy: failed to remove incomplete inspection | ${err}`
          );
        }
      }
    } else {
      completedInspectionData = {
        score: getScore(inspection),
        templateName: getTemplateName(inspection),
        inspector: inspection.inspector,
        inspectorName: inspection.inspectorName,
        creationDate: inspection.creationDate,
        updatedLastDate: inspection.updatedLastDate,
        deficienciesExist: inspection.deficienciesExist,
        inspectionCompleted: inspection.inspectionCompleted,
        property: inspection.property,
      };
      updates[proxyPath] = completedInspectionData;

      if (!dryRun) {
        try {
          await db.ref(proxyPath).set(completedInspectionData);
        } catch (err) {
          throw Error(
            `${PREFIX} failed to set complete inspection data | ${err}`
          );
        }
      }
    }

    return updates;
  },

  /**
   * Write/remove an inspection's property proxy
   * @param  {firebaseAdmin.database} db
   * @param  {String} inspectionId
   * @param  {Object} inspection
   * @return {Promise} - resolves {Object} property inspection proxy
   */
  async syncPropertyInspectionProxy(
    db,
    inspectionId,
    inspection,
    options = {}
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection ID'
    );
    assert(Boolean(inspection), 'has inspection data');
    assert(Boolean(inspection.property), 'has valid inspection');

    const updates = {};
    const { dryRun = false } = options;
    const proxyPath = `/propertyInspectionsList/${inspection.property}/inspections/${inspectionId}`;
    const inspectionData = {
      score: getScore(inspection),
      templateName: getTemplateName(inspection),
      inspector: inspection.inspector,
      inspectorName: inspection.inspectorName,
      creationDate: inspection.creationDate,
      updatedLastDate: inspection.updatedLastDate,
      deficienciesExist: inspection.deficienciesExist,
      inspectionCompleted: inspection.inspectionCompleted,
      itemsCompleted: inspection.itemsCompleted,
      totalItems: inspection.totalItems,
    };

    // Add optional template category
    if (inspection.templateCategory) {
      inspectionData.templateCategory = inspection.templateCategory;
    }

    // Add update
    updates[proxyPath] = inspectionData;

    if (!dryRun) {
      try {
        await db.ref(proxyPath).set(inspectionData);
      } catch (err) {
        throw Error(`${PREFIX} set property inspection proxy failed | ${err}`);
      }
    }

    return updates;
  },

  /**
   * Remove all inspections and inspection proxies for a property
   * @param  {firebaseAdmin.database} db
   * @param  {firebaseAdmin.firestore} fs
   * @param  {firebaseAdmin.storage} storage
   * @param  {String} propertyId
   * @return {Promise} - resolves {Object} hash of updates
   */
  async removeForProperty(db, fs, storage, propertyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(Boolean(storage), 'has storage instance');
    assert(
      propertyId && typeof propertyId === 'string',
      'has property reference'
    );
    const updates = {};
    let inspectionIds = [];

    // Lookup all inspection ID's
    try {
      const inspectionsSnap = await this.queryByProperty(db, propertyId);
      const inspections = inspectionsSnap.val();
      inspectionIds = Object.keys(inspections || {});
    } catch (err) {
      // wrap error
      throw Error(
        `${PREFIX} removeForProperty: query inspections failed | ${err}`
      );
    }

    // Remove each inspections' items' uploads
    for (let i = 0; i < inspectionIds.length; i++) {
      const inspId = inspectionIds[i];

      try {
        await deleteUploads(db, storage, inspId);
      } catch (err) {
        // wrap error
        throw Error(
          `${PREFIX} removeForProperty: upload storage delete failed | ${err}`
        );
      }
    }

    // Collect inspections to delete in `updates`
    inspectionIds.forEach(inspectionId => {
      updates[`/inspections/${inspectionId}`] = null;
    });

    // Remove all `/propertyInspectionsList`
    updates[`/propertyInspectionsList/${propertyId}`] = null;

    try {
      await db.ref().update(updates);
    } catch (err) {
      // wrap error
      throw Error(`${PREFIX} update inspection failed | ${err}`);
    }

    const batch = fs.batch();
    let inspectionsSnap = null;

    try {
      inspectionsSnap = await this.firestoreQueryByProperty(fs, propertyId);
    } catch (err) {
      // wrap error
      throw Error(
        `${PREFIX} removeForProperty: query inspections failed | ${err}`
      );
    }

    // Add all inspections to batch remove
    inspectionsSnap.docs.forEach(inspectionDoc =>
      batch.delete(inspectionDoc.ref)
    );

    try {
      await batch.commit();
    } catch (err) {
      // wrap error
      throw Error(
        `${PREFIX} removeForProperty: firestore inspection removal failed | ${err}`
      );
    }

    return updates;
  },

  /**
   * Move an active inspection to /archive
   * removing up all proxy records for inspection
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {Object?} options
   * @return {Promise} - resolves {Object} updates hash
   */
  async archive(db, inspectionId, options = {}) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    const updates = {};
    let { inspection = null } = options;
    const { dryRun = false } = options;

    if (!inspection) {
      try {
        const inspectionSnap = await this.findRecord(db, inspectionId);
        inspection = inspectionSnap.val();
        if (!inspection) throw Error('not found');
      } catch (err) {
        throw Error(`${PREFIX} archive: could not find inspection | ${err}`); // wrap error
      }
    }

    const propertyId = inspection.property;
    const isCompleted = Boolean(inspection.inspectionCompleted);

    // Remove inspection (if it still exists)
    updates[`${INSPECTIONS_PATH}/${inspectionId}`] = null;

    // Add inspection to archive
    updates[`/archive${INSPECTIONS_PATH}/${inspectionId}`] = inspection;

    // Remove property inspection reference
    updates[`/properties/${propertyId}/inspections/${inspectionId}`] = null;

    // Remove any completed inspection proxies
    if (isCompleted) {
      updates[`/completedInspectionsList/${inspectionId}`] = null;
    }

    // Remove property inspection list proxy
    updates[
      `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`
    ] = null;

    if (!dryRun) {
      try {
        // Perform atomic update
        await db.ref().update(updates);
      } catch (err) {
        throw Error(`${PREFIX} archive: failed | ${err}`);
      }
    }

    return updates;
  },

  /**
   * Remove an inspection from archive
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {Object?} options
   * @return {Promise} - resolves {Object} updates
   */
  async unarchive(db, inspectionId, options = {}) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    const updates = {};
    let { inspection = null } = options;
    const { dryRun = false } = options;

    if (!inspection) {
      try {
        const inspectionSnap = await db
          .ref(`/archive${INSPECTIONS_PATH}/${inspectionId}`)
          .once('value');
        inspection = inspectionSnap.val();
        if (!inspection) throw Error('not found');
      } catch (err) {
        throw Error(
          `${PREFIX} unarchive: could not find archived inspection | ${err}`
        ); // wrap error
      }
    }

    // Write inspection
    updates[`${INSPECTIONS_PATH}/${inspectionId}`] = inspection;

    // Remove inspection from archive
    updates[`/archive${INSPECTIONS_PATH}/${inspectionId}`] = null;

    // Re-add property inspection reference
    updates[
      `/properties/${inspection.property}/inspections/${inspectionId}`
    ] = true;

    // Construct completed proxy
    // updates hash
    try {
      const completedProxyUpdates = await this.syncCompletedInspectionProxy(
        db,
        inspectionId,
        inspection,
        { dryRun: true }
      );

      Object.assign(updates, completedProxyUpdates);
    } catch (err) {
      throw Error(`${PREFIX} unarchive: completed proxy failed | ${err}`);
    }

    // Construct property inspection
    // proxy updates hash
    try {
      const propertyInspProxyUpdate = await this.syncPropertyInspectionProxy(
        db,
        inspectionId,
        inspection,
        { dryRun: true }
      );

      Object.assign(updates, propertyInspProxyUpdate);
    } catch (err) {
      throw Error(
        `${PREFIX} unarchive: property inspection proxy failed | ${err}`
      );
    }

    if (!dryRun) {
      try {
        // Perform atomic update
        await db.ref().update(updates);
      } catch (err) {
        throw Error(`${PREFIX} unarchive: failed | ${err}`);
      }
    }

    return updates;
  },

  /**
   * Reassign an Inspection to a new
   * property by mocking archival and
   * unarchival updates
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {String}  destPropertyId
   * @param  {Object?}  options
   * @return {Promise} - resolves {Object} updates
   */
  async reassignProperty(db, inspectionId, destPropertyId, options = {}) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(
      destPropertyId && typeof destPropertyId === 'string',
      'has destination property id'
    );

    const updates = {};
    let { inspection = null } = options;
    const { dryRun = false } = options;

    // Lookup inspection
    if (!inspection) {
      try {
        const inspectionSnap = await this.findRecord(db, inspectionId);
        inspection = inspectionSnap.val();
        if (!inspection) throw Error('not found');
      } catch (err) {
        throw Error(
          `${PREFIX} reassignProperty: could not find inspection: ${err}`
        ); // wrap error
      }
    }

    const deficientItems = {};

    // Lookup active DI's and copy current state
    try {
      const diSnapshots = await diModel.findAllByInspection(db, inspectionId);
      diSnapshots.forEach(di => {
        deficientItems[di.ref.path.toString()] = di.val();
      });
    } catch (err) {
      throw Error(
        `${PREFIX} reassignProperty: Deficient Item lookup failed: ${err}`
      ); // wrap error
    }

    // Lookup archived DI's and copy current
    // state to active deficient items
    try {
      const archiveSnap = await archiveModel.deficientItem.findAllByInspection(
        db,
        inspectionId
      );
      archiveSnap.forEach(di => {
        deficientItems[di.ref.path.toString()] = di.val();
      });
    } catch (err) {
      throw Error(
        `${PREFIX} reassignProperty: Archived Deficient Item lookup failed: ${err}`
      ); // wrap error
    }

    // Construct inspection
    // archive updates hash
    try {
      const archiveUpdates = await this.archive(db, inspectionId, {
        inspection,
        dryRun: true,
      });
      Object.assign(updates, archiveUpdates);
    } catch (err) {
      throw Error(`${PREFIX} reassignProperty: failed call to archive: ${err}`);
    }

    // Construct inspection
    // unarchive updates hash
    // merging in destination property
    // ID in place of src property ID
    try {
      const unarchiveUpdatesSrc = await this.unarchive(db, inspectionId, {
        inspection,
        dryRun: true,
      });
      const reSearch = new RegExp(inspection.property, 'g');
      const unarchiveUpdates = JSON.parse(
        JSON.stringify(unarchiveUpdatesSrc).replace(reSearch, destPropertyId)
      );

      Object.assign(updates, unarchiveUpdates);
    } catch (err) {
      throw Error(
        `${PREFIX} reassignProperty: failed call to archive | ${err}`
      );
    }

    // Add new Deficient Item paths
    // Remove old Deficient Item paths
    Object.keys(deficientItems).forEach(currentPath => {
      const isArchive = currentPath.indexOf('/archive') === 0;
      const currentPropertyId = currentPath.split('/')[isArchive ? 3 : 2];
      const targetPath = currentPath.replace(currentPropertyId, destPropertyId);
      updates[currentPath] = null;
      updates[targetPath] = deficientItems[currentPath];
    });

    if (!dryRun) {
      try {
        // Perform atomic update
        await db.ref().update(updates);
      } catch (err) {
        throw Error(`${PREFIX} reassignProperty: failed | ${err}`);
      }
    }

    return updates;
  },

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
  async firestoreReassignProperty(
    fs,
    inspectionId,
    srcPropertyId,
    destPropertyId
  ) {
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
      const deficientItemSnap = await diModel.firestoreQueryByInspection(
        fs,
        inspectionId
      );

      deficientItemSnap.docs.forEach(diDoc =>
        batch.update(diDoc.ref, { property: destPropertyId })
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreReassignProperty: failed to lookup DIs: ${err}`
      );
    }

    // Add each archived deficient item
    // property relationship updates to batch
    try {
      const archivedDefItemSnap = await archiveModel.deficientItem.firestoreQueryByInspection(
        fs,
        inspectionId
      );
      archivedDefItemSnap.docs.forEach(diDoc =>
        batch.update(diDoc.ref, { property: destPropertyId })
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreReassignProperty: failed to lookup DIs: ${err}`
      );
    }

    return batch.commit();
  },

  /**
   * Create a Firestore inspection
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} inspectionId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, inspectionId, data) {
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
  firestoreUpdateRecord(fs, inspectionId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has deficient item id'
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
   * Create or update a Firestore inspection
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  inspectionId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, inspectionId, data) {
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
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
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
        `${PREFIX} firestoreUpsertRecord: ${
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
  firestoreFindRecord(fs, inspectionId) {
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
  async firestoreRemoveRecord(fs, inspectionId, data, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    let inspectionDocRef = null;
    let inspection = null;

    if (!data) {
      try {
        const snap = await this.firestoreFindRecord(fs, inspectionId);
        inspectionDocRef = snap.ref;
        inspection = snap.data();
      } catch (err) {
        throw Error(`${PREFIX}: firestoreRemoveRecord: ${err}`);
      }
    } else {
      inspectionDocRef = fs.collection(INSPECTION_COLLECTION).doc(inspectionId);
      inspection = data;
    }

    if (!inspection) return; // inspection does not exist

    const batch = parentBatch || fs.batch();
    batch.delete(inspectionDocRef);

    // Add archive updates to transaction
    await archiveModel.inspection.firestoreCreateRecord(
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
  firestoreDestroyRecord(fs, inspectionId) {
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
  firestoreQueryByProperty(fs, propertyId) {
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
  firestoreQuery(fs, query, batch) {
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
  firestoreLatestCompletedQuery(fs, before, query = {}) {
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
  firestoreRemoveForProperty(fs, propertyId, batch) {
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
            archiveModel.inspection.firestoreQueryByProperty(
              fs,
              propertyId,
              transaction
            ),
          ]);
          activeInspSnap.forEach(({ ref }) => inspectionRefs.push(ref));
          archivedInspSnap.forEach(({ ref }) => inspectionRefs.push(ref));
        } catch (err) {
          throw Error(
            `${PREFIX} firestoreRemoveForProperty: inspection lookup failed: ${err}`
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
          `${PREFIX} firestoreRemoveForProperty: inspection deletes failed: ${err}`
        );
      });
  },

  /**
   * Remove all uploads for an inspection's item
   * @param  {admin.storage} storage
   * @param  {Object} item
   * @return {Promise} - All remove requests grouped together
   */
  async deleteItemUploads(storage, item) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(item && typeof item === 'object', 'has item object');

    const requests = [];
    const urls = itemUploads.getUploadUrls(item);

    for (let i = 0; i < urls.length; i++) {
      requests.push(itemUploads.delete(storage, urls[i]));
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
