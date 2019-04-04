const adminUtils = require('../../utils/firebase-admin')
const log = require('../../utils/logger');

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
    return updates;
  });
}
