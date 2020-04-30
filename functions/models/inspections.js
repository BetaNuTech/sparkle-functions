const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const diModel = require('./deficient-items');

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
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has inspection id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${INSPECTIONS_PATH}/${inspectionId}`).update(data);
  },

  /**
   * Remove inspection by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, inspectionId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has property id`
    );

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
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .ref(INSPECTIONS_PATH)
      .orderByChild('property')
      .equalTo(propertyId)
      .once('value');
  },

  /**
   * Set/update inspections PDF report status
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param {String} inspectionId
   * @param {String} status
   * @return {Promise}
   */
  setPDFReportStatus(db, inspectionId, status) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(
      INSPECTION_REPORT_STATUSES.includes(status),
      'has valid PDF inspection report status'
    );

    return db
      .ref(`${INSPECTIONS_PATH}/${inspectionId}/inspectionReportStatus`)
      .set(status);
  },

  /**
   * Set/update inspections PDF report url
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param {String} inspectionId
   * @param {String} url
   * @return {Promise}
   */
  setReportURL(db, inspectionId, url) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    assert(url && typeof url === 'string', `${PREFIX} has report url`);
    return db
      .ref(`${INSPECTIONS_PATH}/${inspectionId}/inspectionReportURL`)
      .set(url);
  },

  /**
   * Update inspections PDF report UNIX timestamp to now
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param {String} inspectionId
   * @return {Promise}
   */
  updatePDFReportTimestamp(db, inspectionId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );
    return db
      .ref(`${INSPECTIONS_PATH}/${inspectionId}/inspectionReportUpdateLastDate`)
      .set(Date.now() / 1000);
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
   * Move an active inspection to /archive
   * removing up all proxy records for inspection
   * @param {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {Object?} options
   * @return {Promise} - resolves {Object} updates hash
   */
  async archive(db, inspectionId, options = {}) {
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

    // Lookup DI's and copy current state
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
      const currentPropertyId = currentPath.split('/')[2];
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
    // TODO: Make property inspections array
    //       and add to batch update
    try {
      await propertiesRef.doc(srcPropertyId).set(
        {
          inspections: {
            [inspectionId]: FieldValue.delete(),
          },
        },
        { merge: true }
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreReassignProperty: failed to update source property: ${err}`
      );
    }

    // Add inspection to destination property
    // TODO: Make property inspections array
    //       and add to batch update
    try {
      await propertiesRef.doc(destPropertyId).set(
        {
          inspections: {
            [inspectionId]: true,
          },
        },
        { merge: true }
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreReassignProperty: failed to update dest property: ${err}`
      );
    }

    let deficientItemSnap = null;

    try {
      deficientItemSnap = await diModel.firestoreQueryByInspection(
        fs,
        inspectionId
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreReassignProperty: failed to lookup DIs: ${err}`
      );
    }

    // Add each deficient item property
    // relationship updates to batch
    deficientItemSnap.docs.forEach(diDoc =>
      batch.update(diDoc.ref, { property: destPropertyId })
    );

    return batch.commit();
  },

  /**
   * Create or update a Firestore inspection
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  inspectionId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, inspectionId, data) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has inspection id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);

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
    const upsert = {
      ...data,
      score: getScore(data),
      templateName: getTemplateName(data),
    };

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
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has inspection id`
    );
    return fs
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .get();
  },

  /**
   * Remove Firestore Inspection
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, inspectionId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has inspection id`
    );
    return fs
      .collection(INSPECTION_COLLECTION)
      .doc(inspectionId)
      .delete();
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
