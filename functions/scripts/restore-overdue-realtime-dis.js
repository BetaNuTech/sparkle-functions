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
          if (diItem.createdAt) {
            return;
          }

          if (diItem.state !== 'overdue') {
            log.info(
              `Non-overdue DI missing created At ${propertyId}/${defItemId}`
            );
            return;
          }

          log.info(`Syncing overdue deficient item "${defItemId}"`);

          let fsDiRecord = null;
          try {
            const diDoc = await model.firestoreFindRecord(fs, defItemId);
            fsDiRecord = diDoc.data();
            if (!fsDiRecord) {
              throw Error('firestore record does not exist');
            }
          } catch (err) {
            log.error(
              `Failed to fetch deficient item "${defItemId}" from Firestore | ${err}`
            );
          }

          try {
            delete fsDiRecord.property;
            await model.realtimeUpdateRecord(
              db,
              propertyId,
              defItemId,
              fsDiRecord
            );
          } catch (err) {
            log.error(
              `Failed to update deficient item "${propertyId}/${defItemId}" to Realtime | ${err}`
            );
          }
        }
      );
    }
  );

  log.info('Completed overdue deficient item sync successfully');
  process.exit();
})();
