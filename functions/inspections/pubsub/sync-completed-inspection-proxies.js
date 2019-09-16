const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const { isInspectionWritable } = require('../process-write/utils');
const completedInspectionsList = require('../process-write/completed-inspections-list');
const { isInspectionOutdated } = require('./utils');

const PREFIX = 'inspections: pubsub: sync-completed-inspection-proxies:';

/**
 * sync inspection completedInspectionsList
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncCompletedInspectionProxieshandler(
  topic = '',
  pubsub,
  db
) {
  return pubsub
    .topic(topic)
    .onPublish(async function syncCompletedInspectionProxiesHandler() {
      const updates = {};
      await adminUtils.forEachChild(
        db,
        '/inspections',
        async function proccessCompletedInspectionProxyWrite(
          inspectionId,
          inspection
        ) {
          try {
            // Throw errors if inspection cannot write proxies
            await isInspectionWritable(db, inspection, PREFIX);

            const isProxyOutdated = await isInspectionOutdated(
              db,
              inspection,
              `/completedInspectionsList/${inspectionId}`
            );

            if (isProxyOutdated) {
              // Update inspections' completedInspectionsList proxy
              const result = await completedInspectionsList({
                db,
                inspectionId,
                inspection,
              });

              updates[inspectionId] = result ? 'upserted' : 'removed';
            }
          } catch (err) {
            log.error(`${PREFIX} ${topic} | ${err}`);
          }
        }
      );

      return updates;
    });
};