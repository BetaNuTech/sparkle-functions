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
              `${PREFIX} ${topic}: removed archived property ${propertyId} proxies at /propertyInspectionsList`
            );
          } catch (err) {
            log.error(
              `${PREFIX} ${topic}: /propertyInspectionsList/${propertyId} | ${err}`
            );
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
                `${PREFIX} ${topic} removed archived inspection "${inspectionId}" property proxy`
              );
            } catch (err) {
              log.error(
                `${PREFIX} ${topic} unexpected cleanup error for inspection "${inspectionId}" | ${err}`
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
              `${PREFIX} ${topic}: removed archived inspection "${inspectionId}" proxies`
            );
          } catch (err) {
            log.error(
              `${PREFIX} ${topic}: error removing completed inspection proxy for inspection "${inspectionId}" | ${err}`
            );
          }
        }
      );

      return updates;
    });
};
