const log = require('../../utils/logger');
const config = require('../../config');
const model = require('../../models/deficient-items');
const processPropertyMeta = require('../../properties/process-meta');
const {forEachChild} = require('../../utils/firebase-admin')

const LOG_PREFIX = 'deficient-items: cron: sync-overdue:';
const FIVE_DAYS_IN_SEC = 432000;
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
        let { state } = diItem;
        const currentStartDate = diItem.currentStartDate || 0;
        const currentDueDate = diItem.currentDueDate || 0;

        // Eligible for "requires-progress-update" state
        // when due date is at least 5 days from the start date
        const isRequiresProgressUpdateStateEligible = FIVE_DAYS_IN_SEC <= (currentDueDate - currentStartDate);

        // Second measurements until DI becomes "overdue"
        const secondsUntilDue = currentDueDate - now;
        const secondsUntilHalfDue = (currentDueDate - currentStartDate) / 2;

        try {
          if (OVERDUE_ELIGIBLE_STATES.includes(state) && secondsUntilDue <= 0) {
            // Progress state
            state = diItem.state = 'overdue';
            const stateUpdates = await model.updateState(db, diItemSnap, state);
            Object.assign(updates, stateUpdates); // add DI state updates to updates

            // Sync DI's changes to its' property's metadata
            const metaUpdates = await processPropertyMeta(db, propertyId);
            log.info(`${LOG_PREFIX} property: ${propertyId} | | item: ${itemId} | deficiency overdue`);
            Object.assign(updates, metaUpdates); // add property meta updates to updates
          } else if (
            state === 'pending' &&
            isRequiresProgressUpdateStateEligible &&
            secondsUntilDue < secondsUntilHalfDue) {

            // Progress state
            state = diItem.state = 'requires-progress-update';
            const stateUpdates = await model.updateState(db, diItemSnap, state);
            log.info(`${LOG_PREFIX} property: ${propertyId} | | item: ${itemId} | deficiency requires progress update`);
            Object.assign(updates, stateUpdates); // add state updates to updates
          }
        } catch (e) {
          log.error(`${LOG_PREFIX} ${e}`);
        }
      });
    });

    return updates;
  });
}
