const log = require('../utils/logger');
const processPropertyMeta = require('../properties/process-meta');
const deleteUploads = require('./delete-uploads');

const LOG_PREFIX = 'inspections: on-delete:';

/**
 * Factory for inspection onDelete handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @return {Function} - inspection onDelete handler
 */
module.exports = function createOnDeleteHandler(db, storage) {
  return async (inspectionSnap, event) => {
    const { inspectionId } = event.params;
    const inspection = inspectionSnap.val() || {};
    const propertyId = inspection.property;
    const isCompleted = Boolean(inspection.inspectionCompleted);
    const updates = Object.create(null);
    const requests = [];

    log.info(`${LOG_PREFIX} ${inspectionId} deleted`);

    if (!propertyId || !inspection) {
      log.error(
        `${LOG_PREFIX} inspection ${inspectionId} missing property reference`
      );
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
    updates[`/propertyInspections/${propertyId}/inspections/${inspectionId}`] =
      'removed';
    updates[
      `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`
    ] = 'removed';

    requests.push(
      db
        .ref(`/propertyInspections/${propertyId}/inspections/${inspectionId}`)
        .remove(),
      db
        .ref(
          `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`
        )
        .remove()
    );

    // Wait for proxy removal
    try {
      await Promise.all(requests).then(() => updates);
    } catch (e) {
      log.error(
        `${LOG_PREFIX} ${inspectionId} proxy record cleanup failed: ${e}`
      );
    }

    // Update property attributes related
    // to completed inspection meta data
    if (isCompleted) {
      const metaUpdates = await processPropertyMeta(db, propertyId);
      Object.assign(updates, metaUpdates); // combine updates
    }

    // Removal all uploads, ignoring errors
    try {
      await deleteUploads(db, storage, inspectionId);
    } catch (err) {
      log.error(`${LOG_PREFIX} ${err}`);
    }

    return updates;
  };
};
