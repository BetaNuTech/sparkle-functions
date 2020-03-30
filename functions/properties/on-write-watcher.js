const assert = require('assert');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const propertiesModel = require('../models/properties');

const PREFIX = 'properties: on-write:';

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db, fs) {
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return async (change, event) => {
    const { propertyId } = event.params;

    if (!propertyId) {
      log.error(`${PREFIX} incorrectly defined event parameter "propertyId"`);
      return;
    }

    // Property deleted
    if (!change.after.exists()) {
      return;
    }

    // Sync property updates to property template proxies
    try {
      const updates = await propertyTemplates.processWrite(
        db,
        propertyId,
        change.after.val().templates
      );
      if (updates && Object.keys(updates).length) {
        log.info(`${PREFIX} property "${propertyId}" template list updated`);
      }
    } catch (err) {
      log.error(
        `${PREFIX} failed to update property "${propertyId}" template list | ${err}`
      );
    }

    // Sync property updates to Firestore
    try {
      await propertiesModel.firestoreUpsertRecord(
        fs,
        propertyId,
        change.after.val()
      );
    } catch (err) {
      const updateType = change.before.exists() ? 'update' : 'create';
      log.error(
        `${PREFIX} failed to ${updateType} Firestore property "${propertyId}" | ${err}`
      );
    }
  };
};
