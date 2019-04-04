const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const createDeficientItems = require('../inspections/utils/create-deficient-items');
const findRemovedKeys = require('../utils/find-removed-keys');

const LOG_PREFIX = 'deficient-items: on-inspection-write:';
const DEFICIENT_ITEM_PROXY_ATTRS = config.deficientItems.inspectionItemProxyAttrs;

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
        await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).remove();
        updates[`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`] = 'removed';
        log.info(`${LOG_PREFIX} removing possible deficient items for deleted inspection`);
      }

      // Inspection deleted, incomplete, or deficient list disabled
      if (!inspection || !inspection.inspectionCompleted || !inspection.trackDeficientItems) {
        return updates;
      }

      // Calculate expected and lookup current DI's
      const expectedDeficientItems = createDeficientItems(inspection);
      const currentDeficientItemsSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
      const currentDeficientItems = currentDeficientItemsSnap.val() || {};

      // Remove any deficient item(s) belonging
      // to inspection items that are no longer deficient
      const removeDeficientItemIds = findRemovedKeys(currentDeficientItems, expectedDeficientItems);

      for (let i = 0; i < removeDeficientItemIds.length; i++) {
        const removeDeficientItemId = removeDeficientItemIds[i];
        await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${removeDeficientItemId}`).remove();
        updates[`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${removeDeficientItemId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed no longer deficient item ${removeDeficientItemId}`);
      }

      // Update each existing deficient items'
      // proxy data from its' source inspection item
      const updateDeficientItemIds = Object.keys(currentDeficientItems).filter(itemId => expectedDeficientItems[itemId]);

      for (let i = 0; i < updateDeficientItemIds.length; i++) {
        const updateDeficientItemId = updateDeficientItemIds[i];
        const deficientItem = currentDeficientItems[updateDeficientItemId];
        const sourceItem = inspection.template.items[updateDeficientItemId] || {};
        const itemUpdates = getDefItemDiffs(sourceItem, deficientItem, DEFICIENT_ITEM_PROXY_ATTRS);

        if (Object.keys(itemUpdates).length) {
          await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${updateDeficientItemId}`).update(itemUpdates);
          updates[`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${updateDeficientItemId}`] = 'updated';
          log.info(`${LOG_PREFIX} updating out of date deficient item ${updateDeficientItemId}`);
          Object.assign(currentDeficientItems[updateDeficientItemId], itemUpdates); // update current snapshot value
        }
      }

      // Add new deficient item(s) to DI
      const addDeficientItemIds = Object.keys(expectedDeficientItems).filter(itemId => !currentDeficientItems[itemId]);

      for (let i = 0; i < addDeficientItemIds.length; i++) {
        const addDeficientItemId = addDeficientItemIds[i];
        await db.ref(`/propertyInspectionDeficientItems/${inspection.property}/${inspectionId}/${addDeficientItemId}`).set(expectedDeficientItems[addDeficientItemId]);
        updates[`/propertyInspectionDeficientItems/${inspection.property}/${inspectionId}/${addDeficientItemId}`] = 'created';
        log.info(`${LOG_PREFIX} added new deficient item ${addDeficientItemId}`);
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
  const propertyGroupsSnap = await db.ref('/propertyInspectionDeficientItems').once('value');
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

/**
 * Get differences between an inspection item
 * and its' source inspection item for the given
 * attributes
 * @param  {Object} src
 * @param  {Object} dest
 * @param  {Object} attrs - key of attributes to diff
 * @return {Object} - diff object
 */
function getDefItemDiffs(src = {}, dest = {}, attrs = {}) {
  const updates = Object.create(null);

  Object.keys(attrs)
  .filter(diAttr => Boolean(src[attrs[diAttr]])) // Ignore falsey source values
  .filter(diAttr => diff(src[attrs[diAttr]], dest[diAttr])) // different attrs only
  .forEach(diAttr => {
    const sourceItemAttr = attrs[diAttr];
    if (typeof src[sourceItemAttr] === 'object') {
      return updates[diAttr] = JSON.parse(JSON.stringify(src[sourceItemAttr]));
    } else {
      return updates[diAttr] = src[sourceItemAttr];
    }
  });

  return updates;
}

/**
 * Determine if two values are different
 * @param  {Any} a
 * @param  {Any} b
 * @return {Boolean}
 */
function diff(a, b) {
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b); // deep equal
  } else {
    return a !== b;
  }
}
