const assert = require('assert');
const log = require('../utils/logger');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'inspections: on-create:';

/**
 * Factory for inspection onCreate handler
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - handler
 */
module.exports = function createOnHandler(fs) {
  assert(Boolean(fs), 'has firestore DB instance');

  return async (inspectionSnap, event) => {
    const { inspectionId } = event.params;
    const inspection = inspectionSnap.val() || {};

    // Create matching Firestore
    // w/ full Inspection data
    try {
      await inspectionsModel.firestoreUpsertRecord(
        fs,
        inspectionId,
        inspection
      );
    } catch (err) {
      log.error(
        `${PREFIX} creating Firestore inspection "${inspectionId}" failed | ${err}`
      );
    }
  };
};
