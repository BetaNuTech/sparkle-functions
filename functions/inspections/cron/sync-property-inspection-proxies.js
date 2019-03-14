const log = require('../../utils/logger');
const { isInspectionWritable } = require('../process-write/utils');
const propertyInspectionsList = require('../process-write/property-inspections-list');
const { isInspectionOutdated, forEachInspection } = require('./utils');

const LOG_PREFIX = 'inspections: cron: sync-property-inspection-proxies:';

/**
 * sync inspection's propertyInspectionsList
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncPropertyInspectionProxieshandler(topic = '', pubsub, db) {
  return pubsub
  .topic(topic)
  .onPublish(async function syncPropertyInspectionProxiesHandler() {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    await forEachInspection(db, async function proccessPropertyInspectionProxyWrite(
      inspectionId,
      inspection) {
      try {
        // Throw errors if inspection cannot write proxies
        await isInspectionWritable(db, inspection, LOG_PREFIX);

        const isProxyOutdated = await isInspectionOutdated(
          db,
          inspection,
          `/propertyInspectionsList/${inspection.property}/inspections/${inspectionId}`
        );

        if (isProxyOutdated) {
          // Update inspections' propertyInspectionsList proxy
          await propertyInspectionsList({
            db,
            inspectionId,
            inspection
          });

          updates[inspectionId] = true;
        }
      } catch (e) {
        log.error(`${LOG_PREFIX} ${e}`);
      }
    });

    return updates;
  });
}
