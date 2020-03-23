const assert = require('assert');
const log = require('../utils/logger');
const processWrite = require('./process-write');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'inspections: on-attribute-write:';

/**
 * Factory for general inspection updated onWrite handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - inspection attribute onWrite handler
 */
module.exports = function createOnAttributeWriteHandler(db, fs) {
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return async (change, event) => {
    const updates = {};
    const { inspectionId } = event.params;

    if (!inspectionId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "inspectionId"`);
      return;
    }

    // Inspection deleted or already up to date
    if (!change.after.exists() || change.before.val() === change.after.val()) {
      return updates;
    }

    // Lookup parent Inspection
    // of updated attribute
    let inspection = null;
    try {
      const inspectionSnapshot = await change.after.ref.parent.once('value');

      if (!inspectionSnapshot.exists()) {
        log.info(`${PREFIX} ${inspectionId} no inspection record found`);
        return updates;
      }

      inspection = inspectionSnapshot.val();
    } catch (err) {
      throw Error(
        `${PREFIX} failed to lookup parent inspection "${inspectionId}" | ${err}`
      );
    }

    // Upsert matching Firestore
    // w/ full Inspection data
    try {
      await inspectionsModel.firestoreUpsertRecord(
        fs,
        inspectionId,
        inspection
      );
    } catch (err) {
      log.error(
        `${PREFIX} upserting Firestore inspection "${inspectionId}" failed | ${err}`
      );
    }

    // Update proxy Inspections,
    // and Property Meta data in
    // both Realtime & Firestore
    try {
      log.info(
        `${PREFIX} ${inspectionId} updated, migrating proxy inspections`
      );
      const processWriteUpdates = await processWrite(
        db,
        fs,
        inspectionId,
        inspection
      );
      return Object.assign({}, processWriteUpdates, updates);
    } catch (err) {
      // Handle any errors
      log.error(
        `${PREFIX} failed to updated inspection proxies "${inspectionId}" | ${err}`
      );
    }

    return updates;
  };
};
