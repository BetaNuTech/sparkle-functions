const assert = require('assert');
const log = require('../utils/logger');
const processWrite = require('./process-write');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'inspections: on-write:';

/**
 * DEPRECATED: Factory for inspection onWrite handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - inspection onWrite handler
 */
module.exports = function createOnWriteHandler(db, fs) {
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return async function onWriteHandler(change, event) {
    const { inspectionId } = event.params;

    if (!inspectionId) {
      log.error(`${PREFIX} incorrectly defined event parameter "inspectionId"`);
      return;
    }

    // Inspection removed
    if (!change.after.exists()) {
      return;
    }

    const data = change.after.val();

    try {
      await processWrite(db, fs, inspectionId, data);
      log.info(`${PREFIX} inspection "${inspectionId}" upserted`);
    } catch (err) {
      log.error(`${PREFIX} inspections process write failed | ${err}`);
    }

    try {
      await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, data);
    } catch (err) {
      log.error(
        `${PREFIX} upserting Firestore inspection "${inspectionId}" failed | ${err}`
      );
    }
  };
};
