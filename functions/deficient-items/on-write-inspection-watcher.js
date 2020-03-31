const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const { getDiffs } = require('../utils/object-differ');
const model = require('../models/deficient-items');
const createDeficientItems = require('./utils/create-deficient-items');
const getLatestItemAdminEditTimestamp = require('./utils/get-latest-admin-edit-timestamp');

const PREFIX = 'deficient-items: on-inspection-write:';
const DEFICIENT_ITEM_PROXY_ATTRS = Object.keys(
  config.deficientItems.inspectionItemProxyAttrs
);

/**
 * Factory for Deficient Items sync on Inspection write
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnInspectionWriteHandler(db, fs) {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(Boolean(fs), 'has firestore DB instance');

  return async (change, event) => {
    const { inspectionId } = event.params;

    assert(Boolean(inspectionId), 'has inspection ID');
    log.info(`${PREFIX} inspection ${inspectionId}`);

    try {
      const inspectionSnap = await change.after.ref.parent.once('value');
      const inspection = inspectionSnap.exists()
        ? Object.assign({ id: inspectionId }, inspectionSnap.val())
        : null;

      // Remove deleted Inspections'
      // possible deficient items
      if (!inspection) {
        const deficientItemSnapshots = await model.findAllByInspection(
          db,
          inspectionId
        );
        await Promise.all(
          deficientItemSnapshots.map(deficientItemSnap =>
            model.toggleArchive(db, fs, deficientItemSnap)
          )
        );
        log.info(`${PREFIX} archived deficient items for deleted inspection`);
      }

      // Inspection deleted, incomplete, or deficient list disabled
      if (
        !inspection ||
        !inspection.inspectionCompleted ||
        !inspection.template ||
        !inspection.template.trackDeficientItems
      ) {
        return;
      }

      // Calculate expected and lookup current DI's
      const expectedDeficientItems = createDeficientItems(inspection);
      const currentDeficientItemSnaps = await model.findAllByInspection(
        db,
        inspectionId
      );
      const currentDeficientItems = {};
      currentDeficientItemSnaps.forEach(deficientItemsSnap => {
        currentDeficientItems[
          deficientItemsSnap.key
        ] = deficientItemsSnap.val();
      });

      // Archive any deficient item(s) belonging
      // to inspection items that are no longer deficient
      const removeDeficientItemIds = findMissingdDeficientItemIDs(
        currentDeficientItems,
        expectedDeficientItems
      );

      for (let i = 0; i < removeDeficientItemIds.length; i++) {
        const removeDeficientItemId = removeDeficientItemIds[i];
        const [deficientItemSnap] = currentDeficientItemSnaps.filter(
          ({ key: id }) => id === removeDeficientItemId
        );
        await model.toggleArchive(db, fs, deficientItemSnap);
        log.info(
          `${PREFIX} archived no longer deficient item ${removeDeficientItemId}`
        );
      }

      // Update each existing deficient items'
      // proxy data from its' source inspection item
      const updateDeficientItemIds = findMatchingDeficientItemIDs(
        currentDeficientItems,
        expectedDeficientItems
      );

      for (let i = 0; i < updateDeficientItemIds.length; i++) {
        const updateDeficientItemId = updateDeficientItemIds[i];
        const deficientItem = currentDeficientItems[updateDeficientItemId];
        const inspectionItemId = deficientItem.item;
        const [deficientItemSnap] = currentDeficientItemSnaps.filter(
          ({ key: id }) => id === updateDeficientItemId
        );
        const sourceItem = inspection.template.items[inspectionItemId] || {};
        const itemUpdates = getDiffs(
          expectedDeficientItems[inspectionItemId],
          deficientItem,
          DEFICIENT_ITEM_PROXY_ATTRS
        );
        const latestAdminEditTimestamp =
          getLatestItemAdminEditTimestamp(sourceItem) || 0;

        // updates the changed deficient Items' score
        if (deficientItem && deficientItem.itemScore) {
          itemUpdates.itemScore = deficientItem.itemScore;
        }

        // Set any latest admin edit as the last updated timestamp
        if (
          latestAdminEditTimestamp &&
          latestAdminEditTimestamp > deficientItem.itemDataLastUpdatedDate
        ) {
          itemUpdates.itemDataLastUpdatedDate = latestAdminEditTimestamp;
        }

        // Write, log, and set in memory w/ any updates
        if (Object.keys(itemUpdates).length) {
          itemUpdates.updatedAt = Date.now() / 1000; // modify updatedAt
          const propertyId = deficientItemSnap.ref.path
            .toString()
            .split('/')[2];
          await model.updateRecord(
            db,
            fs,
            propertyId,
            updateDeficientItemId,
            itemUpdates
          );
          // await deficientItemSnap.ref.update(itemUpdates);
          log.info(
            `${PREFIX} updating out of date deficient item ${updateDeficientItemId}`
          );
          Object.assign(
            currentDeficientItems[updateDeficientItemId],
            itemUpdates
          ); // update current snapshot value
        }
      }

      // Add new deficient item(s) to DI
      // NOTE: these are inspection item ID's
      //       not deficient item identifiers
      const addInspectionItemIds = findMissingdDeficientItemIDs(
        expectedDeficientItems,
        currentDeficientItems
      );

      for (let i = 0; i < addInspectionItemIds.length; i++) {
        const inspectionItemId = addInspectionItemIds[i];
        const deficientItemData = expectedDeficientItems[inspectionItemId];
        const addResult = await model.createRecord(
          db,
          fs,
          inspection.property,
          deficientItemData
        );
        const addedDeficientItemID = Object.keys(addResult)[0];
        log.info(
          `${PREFIX} added new deficient item: ${addedDeficientItemID
            .split('/')
            .pop()}`
        );
      }
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        log.info(
          `${PREFIX} Trello API card not found, removed card refrences from DB`
        );
      }

      log.error(`${PREFIX} ${err}`);
    }
  };
};

/**
 * Compare 2 versions of an inspection's deficient
 * item tree and return the deficient item ID's
 * that no longer exist in target tree
 * @param  {Object} source
 * @param  {Object} target
 * @return {String[]} - deprecated deficient item ID's
 */
function findMissingdDeficientItemIDs(source, target) {
  return Object.keys(source).filter(defItemID => {
    const { item } = source[defItemID];
    const [found] = Object.keys(target).filter(
      targetItemID => target[targetItemID].item === item
    );
    return !found;
  });
}

/**
 * Compare 2 versions of an inspection's deficient
 * item tree and return the deficient item ID's
 * that still exist in target tree
 * @param  {Object} source
 * @param  {Object} target
 * @return {String[]} - deprecated deficient item ID's
 */
function findMatchingDeficientItemIDs(source, target) {
  return Object.keys(source).filter(defItemID => {
    const { item } = source[defItemID]; // inspection item ID
    const [found] = Object.keys(target).filter(
      targetItemID => target[targetItemID].item === item
    );
    return Boolean(found);
  });
}
