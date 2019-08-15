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
});
