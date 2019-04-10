const log = require('../../utils/logger');
const config = require('../../config');
const processPropertyMeta = require('../../properties/process-meta');
const {forEachChild} = require('../../utils/firebase-admin')
const createStateHistory = require('../utils/create-state-history');

const LOG_PREFIX = 'deficient-items: cron: sync-overdue:';
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

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
      await forEachChild(db, `/propertyInspectionDeficientItems/${propertyId}`, async function processDeficientItems(itemId, diItem, diItemSnap) {
        const path = diItemSnap.ref.path.toString();

        try {
          if (OVERDUE_ELIGIBLE_STATES.includes(diItem.state) && diItem.currentDueDate <= now) {
            diItem.state = 'overdue';

            // Update DI's state
            await db.ref(`${path}/state`).set(diItem.state);
            updates[`${path}/state`] = 'updated';

            // Update `stateHistory` with latest DI state
            await db.ref(`${path}/stateHistory`).push(createStateHistory(diItem));
            updates[`${path}/stateHistory`] = 'added';

            // Modify updatedAt to denote changes
            await db.ref(`${path}/updatedAt`).set(Date.now() / 1000);
            updates[`${path}/updatedAt`] = 'updated';

            // Sync DI's changes to its' property's metadata
            const metaUpdates = await processPropertyMeta(db, propertyId);
            log.info(`${LOG_PREFIX} property: ${propertyId} | | item: ${itemId} | deficiency overdue`);
            Object.assign(updates, metaUpdates); // add property meta updates to updates
          }
        } catch (e) {
          log.error(`${LOG_PREFIX} ${e}`);
        }
      });
    });

    return updates;
  });
}
