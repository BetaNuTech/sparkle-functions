const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: inspections:';
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

    return db.ref(`/inspections/${inspectionId}`).once('value');
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
      .ref(`/inspections/${inspectionId}/template/items/${itemId}`)
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
      .ref(`/inspections/${inspectionId}/inspectionReportStatus`)
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
    return db.ref(`/inspections/${inspectionId}/inspectionReportURL`).set(url);
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
      .ref(`/inspections/${inspectionId}/inspectionReportUpdateLastDate`)
      .set(Date.now() / 1000);
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
    const updates = Object.create(null);
    let { inspection = null } = options;
    const { dryRun = false } = options;

    if (!inspection) {
      try {
        const inspectionSnap = await this.findRecord(db, inspectionId);
        inspection = inspectionSnap.val();
        if (!inspection) throw Error('not found');
      } catch (err) {
        throw Error(`${PREFIX} archive could not find inspection | ${err}`); // wrap error
      }
    }

    const propertyId = inspection.property;
    const isCompleted = Boolean(inspection.inspectionCompleted);

    // Remove inspection (if it still exists)
    updates[`/inspections/${inspectionId}`] = null;

    // Add inspection to archive
    updates[`/archive/inspections/${inspectionId}`] = inspection;

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
        throw Error(`${PREFIX} archive failed | ${err}`);
      }
    }

    return updates;
  },
});
