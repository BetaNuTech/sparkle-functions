const assert = require('assert');
const config = require('../config');
const log = require('../utils/logger');
const diModel = require('../models/deficient-items');
const propertiesModel = require('../models/properties');
const diUtils = require('../deficient-items/utils');
const { getDiffs } = require('../utils/object-differ');

const PREFIX = 'inspections: on-write-v2:';
const DEFICIENT_ITEM_PROXY_ATTRS = Object.keys(
  config.deficientItems.inspectionItemProxyAttrsV2
);

/**
 * Factory for inspection onWrite handler
 * @param  {admin.firebase} db - Firestore Admin DB instance
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - inspection onWrite handler
 */
module.exports = function createOnWriteHandler(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async function onWriteHandler(change, event) {
    const { inspectionId } = event.params;
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || null;
    const isDeleted = !afterData;
    if (isDeleted) return; // Ignore delete
    const propertyId = afterData.property;
    const inspection = { ...afterData, id: inspectionId };
    const isTrackingDeficiencies = Boolean(
      inspection.template &&
        inspection.inspectionCompleted &&
        inspection.template.trackDeficientItems
    );
    const { updatedLastDate, migrationDate } = afterData;
    const hasUpdatedLastDate = Boolean(
      updatedLastDate && updatedLastDate !== beforeData.updatedLastDate
    );
    const hasUpdatedMigration = Boolean(
      migrationDate && migrationDate !== beforeData.migrationDate
    );

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

    // For inspections tracking deficiencies
    // archive unapplicable deficiencies,
    // update existing deficiencies,
    // and create new deficiencies
    if (isTrackingDeficiencies) {
      try {
        // Calculate expected and lookup current DI's
        const expectedDeficientItems = diUtils.createDeficientItems(inspection);
        const currentDeficientItemRefs = await diModel.firestoreQueryByInspection(
          fs,
          inspectionId
        );
        const currentDeficientItems = currentDeficientItemRefs.docs.reduce(
          (acc, deficientItemsSnap) => {
            acc[deficientItemsSnap.id] = deficientItemsSnap.data();
            return acc;
          },
          {}
        );

        // Archive any deficiencies belonging
        // to inspection items that are no longer deficient
        const removeDeficiencyIds = diUtils.findMissingItems(
          currentDeficientItems,
          expectedDeficientItems
        );

        for (let i = 0; i < removeDeficiencyIds.length; i++) {
          const removeDeficiencyId = removeDeficiencyIds[i];
          await diModel.firestoreDeactivateRecord(db, fs, removeDeficiencyId);
          log.info(`${PREFIX} deactivated deficiency "${removeDeficiencyId}"`);
        }

        // Update each existing deficient items'
        // proxy data from its' source inspection item
        const updateDeficientItemIds = diUtils.findMatchingItems(
          currentDeficientItems,
          expectedDeficientItems
        );

        for (let i = 0; i < updateDeficientItemIds.length; i++) {
          const updateDeficientItemId = updateDeficientItemIds[i];
          const deficientItem = currentDeficientItems[updateDeficientItemId];
          const expDeficientItem = expectedDeficientItems[deficientItem.item];
          const inspectionItemId = deficientItem.item;
          const itemUpdates = getDiffs(
            expectedDeficientItems[inspectionItemId],
            deficientItem,
            DEFICIENT_ITEM_PROXY_ATTRS
          );

          // Sync deficiency's item score proxy attribute
          if (
            expDeficientItem &&
            typeof expDeficientItem.itemScore === 'number'
          ) {
            itemUpdates.itemScore = expDeficientItem.itemScore;
          }

          // Write, log, and set in memory w/ any updates
          if (Object.keys(itemUpdates).length) {
            itemUpdates.updatedAt = Math.round(Date.now() / 1000); // modify updatedAt
            await diModel.firestoreUpdateRecord(fs, updateDeficientItemId, {
              ...deficientItem,
              ...itemUpdates,
            });
            log.info(
              `${PREFIX} updating outdated deficiency "${updateDeficientItemId}"`
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
        const addInspectionItemIds = diUtils.findMissingItems(
          expectedDeficientItems,
          currentDeficientItems
        );

        for (let i = 0; i < addInspectionItemIds.length; i++) {
          const inspectionItemId = addInspectionItemIds[i];
          const deficiencyData = expectedDeficientItems[inspectionItemId];
          deficiencyData.property = propertyId;
          const newDeficiencyId = diModel.uuid(fs);
          await diModel.firestoreSafelyCreateRecord(
            fs,
            newDeficiencyId,
            deficiencyData
          );
          log.info(`${PREFIX} added new deficiency "${newDeficiencyId}"`);
        }
      } catch (err) {
        if (err.code === 'ERR_TRELLO_CARD_DELETED') {
          log.info(
            `${PREFIX} Trello API card not found, removed card refrences from DB`
          );
        }
        log.error(`${PREFIX} ${err}`);
      }
    }
  };
};
