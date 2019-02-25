const co = require('co');
const log = require('../utils/logger');
const processPropertyMeta = require('./process-property-meta');

const LOG_PREFIX = 'inspections: on-delete:';

/**
 * Factory for inspection onDelete handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - inspection onDelete handler
 */
module.exports = function createOnDeleteHandler(db) {
  return (inspectionSnap, event) => co(function *() {
    const { inspectionId } = event.params;
    const inspection = inspectionSnap.val() || {};
    const propertyId = inspection.property;
    const isCompleted = Boolean(inspection.inspectionCompleted);
    const updates = Object.create(null);
    const requests = [];

    log.info(`${LOG_PREFIX} ${inspectionId} deleted`);

    if (!propertyId || !inspection) {
      log.error(`${LOG_PREFIX} inspection ${inspectionId} missing property reference`);
      return Promise.resolve(updates);
    }

    // Remove any completed inspection proxies
    if (isCompleted) {
      updates[`/completedInspections/${inspectionId}`] = 'removed';
      updates[`/completedInspectionsList/${inspectionId}`] = 'removed';

      requests.push(
        db.ref(`/completedInspections/${inspectionId}`).remove(),
        db.ref(`/completedInspectionsList/${inspectionId}`).remove()
      );
    }

    // Remove property inspection proxies
    updates[`/propertyInspections/${propertyId}/inspections/${inspectionId}`] = 'removed';
    updates[`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`] = 'removed';

    requests.push(
      db.ref(`/propertyInspections/${propertyId}/inspections/${inspectionId}`).remove(),
      db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`).remove()
    );

    // Wait for proxy removal
    try {
      yield Promise.all(requests).then(() => updates);
    } catch (e) {
      log.error(`${LOG_PREFIX} ${inspectionId} proxy record cleanup failed: ${e}`);
    }

    // Update property attributes related
    // to completed inspection meta data
    if (isCompleted) {
      const metaUpdates = yield processPropertyMeta(db, propertyId);
      Object.assign(updates, metaUpdates); // combine updates
    }

    return updates
  });
}
