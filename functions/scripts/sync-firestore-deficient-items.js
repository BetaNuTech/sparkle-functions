const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const { forEachChild } = require('../utils/firebase-admin');
const inspectionsModel = require('../models/inspections');
const model = require('../models/deficient-items');

(async () => {
  await forEachChild(
    db,
    '/propertyInspectionDeficientItems',
    async function eachProperty(propertyId) {
      await forEachChild(
        db,
        `/propertyInspectionDeficientItems/${propertyId}`,
        async function eachPropDefItem(defItemId, diItem, diItemSnap) {
          log.info(`Syncing deficient item "${defItemId}"`);

          // Check if DI has active inspection
          let hasActiveInspection = true;
          try {
            const inspectionSnap = await inspectionsModel.findRecord(
              db,
              diItem.inspection
            );
            hasActiveInspection = inspectionSnap.exists();
          } catch (err) {} // eslint-disable-line

          // Archive inactive DI and exit
          if (!hasActiveInspection) {
            await model.toggleArchive(db, fs, diItemSnap, true);
            log.info(`Archived deficient item: "${defItemId}"`);
            return;
          }

          // Remove firestore only property from DI
          if (diItem.property) {
            try {
              await db
                .ref(
                  `/propertyInspectionDeficientItems/${propertyId}/${defItemId}/property`
                )
                .remove();
            } catch (err) {
              log.err(
                `Failed to remove realtime deficient item "property": ${err}`
              );
            }
            delete diItem.property;
          }

          // Sync Firestore document
          try {
            await model.firestoreUpsertRecord(fs, defItemId, {
              ...diItem,
              property: propertyId,
            });
          } catch (err) {
            log.error(
              `Failed to sync deficient item "${propertyId}/${defItemId}" to Firestore`
            );
          }
        }
      );
    }
  );

  log.info('Completed deficient item sync successfully');
  process.exit();
})();
