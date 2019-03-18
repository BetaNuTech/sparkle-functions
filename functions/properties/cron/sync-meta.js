const log = require('../../utils/logger');

const LOG_PREFIX = 'properties: cron: sync-meta:';

/**
 * Sync meta data of all Properties from their
 * completed inspections
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncPropertiesMetahandler(topic = '', pubsub, db) {
  return pubsub
  .topic(topic)
  .onPublish(async function syncPropertiesMetaHandler() {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);
    return updates;
  });
}
