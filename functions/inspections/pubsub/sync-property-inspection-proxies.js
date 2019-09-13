const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const { isInspectionWritable } = require('../process-write/utils');
const propertyInspectionsList = require('../process-write/property-inspections-list');
const { isInspectionOutdated } = require('./utils');

const PREFIX = 'inspections: pubsub: sync-property-inspection-proxies:';

/**
 * sync inspection's propertyInspectionsList
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncPropertyInspectionProxieshandler(
  topic = '',
  pubsub,
  db
) {
  return pubsub
    .topic(topic)
    .onPublish(async function syncPropertyInspectionProxiesHandler() {
      const updates = {};
      log.info(`${PREFIX} received ${Date.now()}`);

      await adminUtils.forEachChild(
        db,
        '/inspections',
        async function proccessPropertyInspectionProxyWrite(
          inspectionId,
          inspection
        ) {
          try {
            // Throw errors if inspection cannot write proxies
            await isInspectionWritable(db, inspection, PREFIX);

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
                inspection,
              });

              updates[inspectionId] = true;
            }
          } catch (err) {
            log.error(`${PREFIX} | ${err}`);
          }
        }
      );

      return updates;
    });
};
