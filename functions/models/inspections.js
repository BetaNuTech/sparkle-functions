const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: inspections:';
const INSPECTIONS_PATH = '/inspections';
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
      `${PREFIX} has inspection id`
    );

    return db.ref(`${INSPECTIONS_PATH}/${inspectionId}`).once('value');
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
      `${PREFIX} has inspection id`
    );
    assert(
      itemId && typeof itemId === 'string',
      `${PREFIX} has inspection item id`
    );
    return db
      .ref(`${INSPECTIONS_PATH}/${inspectionId}/template/items/${itemId}`)
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
      `${PREFIX} has inspection id`
    );
    assert(
      INSPECTION_REPORT_STATUSES.includes(status),
      `${PREFIX} has valid PDF inspection report status`
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
      `${PREFIX} has inspection id`
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
      `${PREFIX} has inspection id`
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
      `${PREFIX} has inspection id`
    );
    const updates = Object.create(null);
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
      `${PREFIX} has inspection id`
    );
    const updates = Object.create(null);
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
    // TODO: will standard has many relationship work?
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
