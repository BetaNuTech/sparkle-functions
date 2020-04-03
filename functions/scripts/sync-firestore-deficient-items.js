const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const { forEachChild } = require('../utils/firebase-admin');
const model = require('../models/deficient-items');

(async () => {
  await forEachChild(
    db,
    '/propertyInspectionDeficientItems',
    async function eachProperty(propertyId) {
      await forEachChild(
        db,
        `/propertyInspectionDeficientItems/${propertyId}`,
        async function eachPropDefItem(defItemId, diItem) {
          log.info(`Syncing deficient item "${defItemId}"`);

          try {
            await model.firestoreUpsertRecord(fs, defItemId, {
              property: propertyId,
              ...diItem,
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
