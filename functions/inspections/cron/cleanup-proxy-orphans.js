const log = require('../../utils/logger');
const { fetchRecordIds, forEachChild }= require('../../utils/firebase-admin');
const { isInspectionWritable } = require('../process-write/utils');
const completedInspectionsList = require('../process-write/completed-inspections-list');
const { isInspectionOutdated } = require('./utils');

const LOG_PREFIX = 'inspections: cron: cleanup-proxy-orphans:';

/**
 * Cleanup all outdated inspecton proxies
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createCleanupProxyOrphansHandler(topic = '', pubsub, db) {
  return pubsub
  .topic(topic)
  .onPublish(async function syncCleanupProxyOrphansHandler() {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    // Collect all inspection ID's
    const activeInspectionIds = await fetchRecordIds(db, '/inspections');

    return updates;
  });
}
