const assert = require('assert');
const log = require('../utils/logger');
const propertiesModel = require('../models/properties');
const inspectionsModel = require('../models/inspections');

const PREFIX = 'inspections: on-delete-v2:';

/**
 * Factory for inspection onDelete handler
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - inspection onDelete handler
 */
module.exports = function createOnDeleteHandler(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (inspectionSnap, event) => {
    const { inspectionId } = event.params;
    const inspection = inspectionSnap.data() || {};
    const propertyId = inspection.property;
    const isCompleted = Boolean(inspection.inspectionCompleted);
    const batch = fs.batch();

    if (!propertyId || !inspection) {
      throw Error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
    }

    try {
      // Archives deleted inspection
      await inspectionsModel.firestoreRemoveRecord(
        fs,
        inspectionId,
        inspection,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} archiving inspection "${inspectionId}" failed | ${err}`
      );
    }

    // Update property attributes related
    // to completed inspection meta data
    if (isCompleted) {
      try {
        await propertiesModel.updateMetaData(fs, propertyId, batch);
      } catch (err) {
        log.error(
          `${PREFIX} failed to update property "${propertyId}" meta data | ${err}`
        );
      }
    }

    // Commit all updates in batched transation
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} batch updates failed to commit | ${err}`);
    }
  };
};
