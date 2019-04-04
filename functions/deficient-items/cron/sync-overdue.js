const log = require('../../utils/logger');
const processPropertyMeta = require('../../properties/process-meta');
const {forEachChild} = require('../../utils/firebase-admin')

const LOG_PREFIX = 'deficient-items: cron: sync-overdue:';

/**
 * Sync Deficient items from "pending" to "overdue"
 * and update associated property metadata
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncOverdueDeficientItemshandler(topic = '', pubsub, db) {
  return pubsub
  .topic(topic)
  .onPublish(async function syncOverdueDeficientItemsHandler() {
    const updates = Object.create(null);
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    const now = Date.now() / 1000;

    await forEachChild(db, '/propertyInspectionDeficientItems', async function proccessDIproperties(propertyId) {
      await forEachChild(db, `/propertyInspectionDeficientItems/${propertyId}`, async function processDIinspections(inspectionId) {
        await forEachChild(db, `/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`, async function processDeficientItems(itemId, item) {
          try {
            if (item.state === 'pending' && item.currentDueDate <= now) {
              await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`).set('overdue');
              updates[`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`] = 'updated';
              const metaUpdates = await processPropertyMeta(db, propertyId);
              log.info(`${LOG_PREFIX} property: ${propertyId} | inspection: ${inspectionId} | item: ${itemId} | deficiency overdue`);
              Object.assign(updates, metaUpdates); // add property meta updates to updates
            }
          } catch (e) {
            log.error(`${LOG_PREFIX} ${e}`);
          }
        });
      });
    });

    return updates;
  });
}
