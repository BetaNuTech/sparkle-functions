const assert = require('assert');
const log = require('../utils/logger');

const LOG_PREFIX = 'deficient-items: on-inspection-write:';

/**
 * Factory for Deficient Items sync on Inspection write
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnInspectionWriteHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const inspectionId = event.params.inspectionId;

    assert(Boolean(inspectionId), 'has inspection ID');
    log.info(`${LOG_PREFIX} inspection ${inspectionId}`);

    const inspectionSnap = await change.after.ref.parent.once('value');
    const inspection = inspectionSnap.val();

    if (!inspection) {
      const propertyId = await lookupPropertyIdByInspectionId(db, inspectionId);

      if (propertyId) {
        // Remove deleted Inspections' deficient items
        await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}`).remove();
        updates[`/propertyDeficientItems/${propertyId}/${inspectionId}`] = 'removed';
      }

      return updates;
    }

    // TODO

    return updates;
  };
}

/**
 * Lookup a property ID by its' nested inspection ID
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @param  {String} inspectionId
 * @return {Promise} - resolve {String} property ID or empty string
 */
async function lookupPropertyIdByInspectionId(db, inspectionId) {
  const propertyGroupsSnap = await db.ref('/propertyDeficientItems').once('value');
  const propertyGroups = Object.create(null);
  propertyGroupsSnap.forEach(propertyChildSnap =>
    propertyGroups[propertyChildSnap.key] = Object.keys(propertyChildSnap.val())
  );
  const propertyIds = Object.keys(propertyGroups);

  for (let i = 0; i < propertyIds.length; i++) {
    if (propertyGroups[propertyIds[i]].includes(inspectionId)) {
      return propertyIds[i];
    }
  }

  return ''; // unfound
}
