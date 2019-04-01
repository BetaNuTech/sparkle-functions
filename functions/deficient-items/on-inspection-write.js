const assert = require('assert');
const log = require('../utils/logger');
const createDeficientItems = require('../inspections/utils/create-deficient-items');
const findRemovedKeys = require('../utils/find-removed-keys');

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

    try {
      const inspectionSnap = await change.after.ref.parent.once('value');
      const propertyId = await lookupPropertyIdByInspectionId(db, inspectionId);
      const inspection = inspectionSnap.exists() ? Object.assign({ id: inspectionId }, inspectionSnap.val()) : null;

      // Remove deleted Inspections'
      // possible deficient items
      if (!inspection && propertyId) {
        await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}`).remove();
        updates[`/propertyDeficientItems/${propertyId}/${inspectionId}`] = 'removed';
        log.info(`${LOG_PREFIX} removing possible deficient items for deleted inspection`);
      }

      // Inspection deleted, incomplete, or deficient list disabled
      if (!inspection || !inspection.inspectionCompleted || !inspection.trackDeficientItems) {
        return updates;
      }

      // Remove any deficient items belonging
      // to inspection items that are no longer deficient
      const expectedDeficientItems = createDeficientItems(inspection);
      const createdDeficientItemsSnap = await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}`).once('value');
      const createdDeficientItems = createdDeficientItemsSnap.val();
      const oldDeficientItemIds = findRemovedKeys(createdDeficientItems, expectedDeficientItems);

      for (let i = 0; i < oldDeficientItemIds.length; i++) {
        const oldDeficientItemId = oldDeficientItemIds[i];
        await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}/${oldDeficientItemId}`).remove();
        updates[`/propertyDeficientItems/${propertyId}/${inspectionId}/${oldDeficientItemId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed no longer deficient item ${oldDeficientItemId}`);
      }
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
    }

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
