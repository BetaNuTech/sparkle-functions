const log = require('../../utils/logger');
const {fetchRecordIds, forEachChild}= require('../../utils/firebase-admin');

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

    // Collect all property ID's
    const activePropertyIds = await fetchRecordIds(db, '/properties');

    // Cleanup archived property's
    // orphaned proxy inspections
    await forEachChild(db, '/propertyInspectionsList', async function cleanupArchivedPropertyProxies(propertyId) {
      if (activePropertyIds.includes(propertyId)) {
        return; // belongs to active property
      }

      try {
        // Update legacy (TODO remove #53)
        await db.ref(`/propertyInspections/${propertyId}`).remove();
        updates[`/propertyInspections/${propertyId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed archived property ${propertyId} proxies at /propertyInspections`);

        // Update list version
        await db.ref(`/propertyInspectionsList/${propertyId}`).remove();
        updates[`/propertyInspectionsList/${propertyId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed archived property ${propertyId} proxies at /propertyInspectionsList`);
      } catch (e) {
        log.error(`${LOG_PREFIX} /propertyInspectionsList/${propertyId}: ${e}`);
      }
    });

    // Collect all inspection ID's
    const activeInspectionIds = await fetchRecordIds(db, '/inspections');

    // Cleanup archived inspection's
    // orphaned property proxies
    for (let i = 0; i < activePropertyIds.length; i++) {
      const propertyId = activePropertyIds[i];
      await forEachChild(db, `/propertyInspectionsList/${propertyId}/inspections`, async function cleanupArchivedPropInspProxies(inspectionId) {
        if (activeInspectionIds.includes(inspectionId)) {
          return; // belongs to active inspection
        }

        try {
          // Update legacy (TODO remove #53)
          await db.ref(`/propertyInspections/${propertyId}/inspections/${inspectionId}`).remove();
          updates[`/propertyInspections/${propertyId}/inspections/${inspectionId}`] = 'removed';
          log.info(`${LOG_PREFIX} removed archived inspection: ${inspectionId} proxy at /propertyInspections/${propertyId}/inspections`);

          // Update list version
          await db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`).remove();
          updates[`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`] = 'removed';
          log.info(`${LOG_PREFIX} removed archived inspection: ${inspectionId} proxy at /propertyInspectionsList/${propertyId}/inspections`);
        } catch (e) {
          log.error(`${LOG_PREFIX} /propertyInspectionsList/${propertyId}/inspections/${inspectionId}: ${e}`);
        }
      });
    }

    // Cleanup archived inspection's
    // orphaned completed inspection proxies
    await forEachChild(db, '/completedInspectionsList', async function cleanupArchivedCompInspProxies(inspectionId) {
      if (activeInspectionIds.includes(inspectionId)) {
        return; // belongs to active inspection
      }

      try {
        // Update legacy (TODO remove #53)
        await db.ref(`/completedInspections/${inspectionId}`).remove();
        updates[`/completedInspections/${inspectionId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed archived inspection ${inspectionId} proxies at /completedInspections`);

        // Update list version
        await db.ref(`/completedInspectionsList/${inspectionId}`).remove();
        updates[`/completedInspectionsList/${inspectionId}`] = 'removed';
        log.info(`${LOG_PREFIX} removed archived inspection ${inspectionId} proxies at /completedInspectionsList`);
      } catch (e) {
        log.error(`${LOG_PREFIX} /completedInspectionsList/${inspectionId}: ${e}`);
      }
    });

    return updates;
  });
}