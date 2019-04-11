const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const {getDiffs} = require('../utils/object-differ');
const model = require('../models/deficient-items');
const createDeficientItems = require('../inspections/utils/create-deficient-items');
const findRemovedKeys = require('../utils/find-removed-keys');
const getLatestItemAdminEditTimestamp = require('../inspections/utils/get-latest-admin-edit-timestamp');

const LOG_PREFIX = 'deficient-items: on-inspection-write:';
const DEFICIENT_ITEM_PROXY_ATTRS = Object.keys(config.deficientItems.inspectionItemProxyAttrs);

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
      const inspection = inspectionSnap.exists() ? Object.assign({ id: inspectionId }, inspectionSnap.val()) : null;

      // Remove deleted Inspections'
      // possible deficient items
      if (!inspection) {
        const inspectionDisSnap = await model.findAllByInspection(db, inspectionId);
        await Promise.all(inspectionDisSnap.map(inspectionSnap => inspectionSnap.ref.remove()));
        inspectionDisSnap.forEach((inspectionSnap) => updates[inspectionSnap.ref.path.toString()] = 'removed');
        log.info(`${LOG_PREFIX} removing possible deficient items for deleted inspection`);
      }

      // Inspection deleted, incomplete, or deficient list disabled
      if (!inspection || !inspection.inspectionCompleted || !inspection.template || !inspection.template.trackDeficientItems) {
        return updates;
      }

      // Calculate expected and lookup current DI's
      const expectedDeficientItems = createDeficientItems(inspection);
      const currentDeficientItemSnaps = await model.findAllByInspection(db, inspectionId);
      const currentDeficientItems = {};
      currentDeficientItemSnaps.forEach(deficientItemsSnap =>
        currentDeficientItems[deficientItemsSnap.key] = deficientItemsSnap.val());

      // Remove any deficient item(s) belonging
      // to inspection items that are no longer deficient
      const removeDeficientItemIds = findRemovedKeys(currentDeficientItems, expectedDeficientItems);

      for (let i = 0; i < removeDeficientItemIds.length; i++) {
        const removeDeficientItemId = removeDeficientItemIds[i];
        const [deficientItemSnap] = currentDeficientItemSnaps.filter(({key: id}) => id === removeDeficientItemId);
        await deficientItemSnap.ref.remove();
        updates[deficientItemSnap.ref.path.toString()] = 'removed';
        log.info(`${LOG_PREFIX} removed no longer deficient item ${removeDeficientItemId}`);
      }

      // Update each existing deficient items'
      // proxy data from its' source inspection item
      const updateDeficientItemIds = Object.keys(currentDeficientItems).filter(id => {
        const itemId = currentDeficientItems[id].item; // inspection item ID
        return Boolean(expectedDeficientItems[itemId]);
      });

      for (let i = 0; i < updateDeficientItemIds.length; i++) {
        const updateDeficientItemId = updateDeficientItemIds[i];
        const deficientItem = currentDeficientItems[updateDeficientItemId];
        const inspectionItemId = deficientItem.item;
        const [deficientItemSnap] = currentDeficientItemSnaps.filter(({key: id}) => id === updateDeficientItemId);
        const sourceItem = inspection.template.items[inspectionItemId] || {};
        const itemUpdates = getDiffs(expectedDeficientItems[inspectionItemId], deficientItem, DEFICIENT_ITEM_PROXY_ATTRS);
        const latestAdminEditTimestamp = getLatestItemAdminEditTimestamp(sourceItem) || 0;

        // Set any latest admin edit as the last updated timestamp
        if (latestAdminEditTimestamp && latestAdminEditTimestamp > deficientItem.itemDataLastUpdatedDate) {
          itemUpdates.itemDataLastUpdatedDate = latestAdminEditTimestamp;
        }

        // Write, log, and set in memory w/ any updates
        if (Object.keys(itemUpdates).length) {
          itemUpdates.updatedAt = Date.now() / 1000; // modify updatedAt
          await deficientItemSnap.ref.update(itemUpdates);
          updates[deficientItemSnap.ref.path.toString()] = 'updated';
          log.info(`${LOG_PREFIX} updating out of date deficient item ${updateDeficientItemId}`);
          Object.assign(currentDeficientItems[updateDeficientItemId], itemUpdates); // update current snapshot value
        }
      }

      // Add new deficient item(s) to DI
      const addDeficientItemIds = Object.keys(expectedDeficientItems).filter(itemId => !currentDeficientItems[itemId]);

      for (let i = 0; i < addDeficientItemIds.length; i++) {
        const addDeficientItemId = addDeficientItemIds[i];
        const deficientItemData = expectedDeficientItems[addDeficientItemId];
        const addResult = await model.createRecord(db, inspection.property, deficientItemData);
        updates[Object.keys(addResult)[0]] = 'created';
        log.info(`${LOG_PREFIX} added new deficient item ${addDeficientItemId}`);
      }
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
    }

    return updates;
  };
}
