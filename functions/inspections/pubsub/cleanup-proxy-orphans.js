const log = require('../../utils/logger');
const { fetchRecordIds, forEachChild } = require('../../utils/firebase-admin');

const PREFIX = 'inspections: pubsub: cleanup-proxy-orphans:';

/**
 * Cleanup all outdated inspecton proxies
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createCleanupProxyOrphansHandler(
  topic = '',
  pubsub,
  db
) {
  return pubsub
    .topic(topic)
    .onPublish(async function syncCleanupProxyOrphansHandler() {
      const updates = {};
      log.info(`${PREFIX} received ${Date.now()}`);

      // Collect all property ID's
      const activePropertyIds = await fetchRecordIds(db, '/properties');

      // Cleanup archived property's
      // orphaned proxy inspections
      await forEachChild(
        db,
        '/propertyInspectionsList',
        async function cleanupArchivedPropertyProxies(propertyId) {
          if (activePropertyIds.includes(propertyId)) {
            return; // belongs to active property
          }

          try {
            // Update list version
            await db.ref(`/propertyInspectionsList/${propertyId}`).remove();
            updates[`/propertyInspectionsList/${propertyId}`] = 'removed';
            log.info(
              `${PREFIX} removed archived property ${propertyId} proxies at /propertyInspectionsList`
            );
          } catch (e) {
            log.error(`${PREFIX} /propertyInspectionsList/${propertyId}: ${e}`);
          }
        }
      );

      // Collect all inspection ID's
      const activeInspectionIds = await fetchRecordIds(db, '/inspections');

      // Cleanup archived inspection's
      // orphaned property proxies
      for (let i = 0; i < activePropertyIds.length; i++) {
        const propertyId = activePropertyIds[i];
        await forEachChild(
          db,
          `/propertyInspectionsList/${propertyId}/inspections`,
          async function cleanupArchivedPropInspProxies(inspectionId) {
            if (activeInspectionIds.includes(inspectionId)) {
              return; // belongs to active inspection
            }

            try {
              await db
                .ref(
                  `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`
                )
                .remove();
              updates[
                `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`
              ] = 'removed';
              log.info(
                `${PREFIX} removed archived inspection: ${inspectionId} proxy at /propertyInspectionsList/${propertyId}/inspections`
              );
            } catch (e) {
              log.error(
                `${PREFIX} /propertyInspectionsList/${propertyId}/inspections/${inspectionId}: ${e}`
              );
            }
          }
        );
      }

      // Cleanup archived inspection's
      // orphaned completed inspection proxies
      await forEachChild(
        db,
        '/completedInspectionsList',
        async function cleanupArchivedCompInspProxies(inspectionId) {
          if (activeInspectionIds.includes(inspectionId)) {
            return; // belongs to active inspection
          }

          try {
            // Update list version
            await db.ref(`/completedInspectionsList/${inspectionId}`).remove();
            updates[`/completedInspectionsList/${inspectionId}`] = 'removed';
            log.info(
              `${PREFIX} removed archived inspection ${inspectionId} proxies at /completedInspectionsList`
            );
          } catch (e) {
            log.error(
              `${PREFIX} /completedInspectionsList/${inspectionId}: ${e}`
            );
          }
        }
      );

      return updates;
    });
};
