const log = require('../utils/logger');
const processPropertyMeta = require('../properties/utils/process-meta');
const deleteUploads = require('./utils/delete-uploads');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'inspections: on-delete:';

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

    log.info(`${PREFIX} inspection "${inspectionId}" deleted`);

    if (!propertyId || !inspection) {
      throw Error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
    }

    // Removal all uploads, ignoring errors
    // NOTE: Must run before archival, in order
    // to reference inspection's items
    try {
      await deleteUploads(db, storage, inspectionId);
    } catch (err) {
      log.error(`${PREFIX} failed to delete inspection uploads | ${err}`);
    }

    try {
      // Archive deleted inspection
      await inspectionsModel.archive(db, inspectionId, { inspection });
    } catch (err) {
      throw Error(
        `${PREFIX} archiving inspection "${inspectionId}" failed | ${err}`
      );
    }

    // Update property attributes related
    // to completed inspection meta data
    if (isCompleted) {
      try {
        await processPropertyMeta(db, propertyId);
      } catch (err) {
        log.error(
          `${PREFIX} failed to update property "${propertyId}" meta data | ${err}`
        );
      }
    }
  };
};
