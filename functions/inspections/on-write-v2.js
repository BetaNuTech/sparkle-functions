const assert = require('assert');
const log = require('../utils/logger');
const propertiesModel = require('../models/properties');

const PREFIX = 'inspections: on-write-v2:';

/**
 * Factory for inspection onWrite handler
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - inspection onWrite handler
 */
module.exports = function createOnWriteHandler(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async function onWriteHandler(change, event) {
    const { inspectionId } = event.params;
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || null;
    const propertyId = afterData.property;
    const isDeleted = !afterData;
    const { updatedLastDate, migrationDate } = afterData;
    const hasUpdatedLastDate = Boolean(
      updatedLastDate && updatedLastDate !== beforeData.updatedLastDate
    );
    const hasUpdatedMigration = Boolean(
      migrationDate && migrationDate !== beforeData.migrationDate
    );
    if (isDeleted) return; // Ignore delete

    if (!propertyId) {
      throw Error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
    }

    // Update inspections' property meta data
    // when either the updated last date or migration
    // date has changed
    if (hasUpdatedLastDate || hasUpdatedMigration) {
      try {
        await propertiesModel.updateMetaData(fs, propertyId);
      } catch (err) {
        log.error(`${PREFIX} property meta data update failed | ${err}`);
      }
    }
  };
};
