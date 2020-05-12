const assert = require('assert');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const propertiesModel = require('../models/properties');
const templatesModel = require('../models/templates');

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

    // Property deleted, exit
    if (!change.after.exists()) {
      return;
    }

    const beforeData = change.before.val();
    const afterData = change.after.val();

    // Sync property updates to property template proxies
    try {
      const updates = await propertyTemplates.processWrite(
        db,
        propertyId,
        afterData.templates
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
      const upsertData = { ...afterData };
      if (!afterData.templates) upsertData.templates = null;
      if (!afterData.inspections) upsertData.inspections = null;
      await propertiesModel.firestoreUpsertRecord(fs, propertyId, upsertData);
    } catch (err) {
      const updateType = change.before.exists() ? 'update' : 'create';
      log.error(
        `${PREFIX} failed to ${updateType} Firestore property "${propertyId}" | ${err}`
      );
    }

    // Sync Firestore templates with
    // latest property relationships
    try {
      await templatesModel.updatePropertyRelationships(
        fs,
        propertyId,
        beforeData ? Object.keys(beforeData.templates || {}) : [],
        afterData ? Object.keys(afterData.templates || {}) : []
      );
    } catch (err) {
      log.error(
        `${PREFIX} failed to update Firestore templates relationship to property "${propertyId}" | ${err}`
      );
    }
  };
};
