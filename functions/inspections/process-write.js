const co = require('co');
const log = require('../utils/logger');
const processPropertyMeta = require('./process-property-meta');

const LOG_PREFIX = 'inspections: process-write:';

/**
 * Perform update of all inspection proxies: nested,
 * propertyInspections, and completedInspections
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = function processWrite(db, inspectionId, inspection) {
  const updates = {};
  const propertyId = inspection.property;

  return co(function *() {
    if (!propertyId) {
      log.error(`${LOG_PREFIX} property relationship missing`);
      return updates;
    }

    // Stop if inspection dead (belongs to archived property)
    const property = yield db.ref(`/properties/${propertyId}`).once('value');
    if (!property.exists()) {
      log.error(`${LOG_PREFIX} inspection belonging to archived property, stopping`);
      return updates;
    }

    const templateName = inspection.templateName || inspection.template.name;
    const score = inspection.score && typeof inspection.score === 'number' ? inspection.score : 0;

    // Update property/inspections
    const inspectionData = {
      score,
      inspector: inspection.inspector,
      inspectorName: inspection.inspectorName,
      creationDate: inspection.creationDate,
      updatedLastDate: inspection.updatedLastDate,
      templateName: templateName,
      deficienciesExist: inspection.deficienciesExist,
      inspectionCompleted: inspection.inspectionCompleted,
      itemsCompleted: inspection.itemsCompleted,
      totalItems: inspection.totalItems
    };

    // Add optional template category
    if (inspection.templateCategory) {
      inspectionData.templateCategory = inspection.templateCategory;
    }

    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspectionId}`).set(inspectionData);
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`).set(inspectionData);
    updates[`/propertyInspections/${propertyId}/inspections/${inspectionId}`] = 'upserted';
    updates[`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`] = 'upserted';

    if (inspection.inspectionCompleted) {
      const completedInspectionData = {
        score,
        inspector: inspection.inspector,
        inspectorName: inspection.inspectorName,
        creationDate: inspection.creationDate,
        updatedLastDate: inspection.updatedLastDate,
        templateName: templateName,
        deficienciesExist: inspection.deficienciesExist,
        inspectionCompleted: inspection.inspectionCompleted,
        property: inspection.property
      };

      yield db.ref(`/completedInspections/${inspectionId}`).set(completedInspectionData);
      yield db.ref(`/completedInspectionsList/${inspectionId}`).set(completedInspectionData);
      updates[`/completedInspections/${inspectionId}`] = completedInspectionData;
      updates[`/completedInspectionsList/${inspectionId}`] = completedInspectionData;
    } else {
      yield db.ref(`/completedInspections/${inspectionId}`).remove();
      yield db.ref(`/completedInspectionsList/${inspectionId}`).remove();
      updates[`/completedInspections/${inspectionId}`] = 'removed';
      updates[`/completedInspectionsList/${inspectionId}`] = 'removed';
    }

    // Update property attributes related
    // to completed inspection meta data
    const metaUpdates = yield processPropertyMeta(db, propertyId);
    Object.assign(updates, metaUpdates); // combine updates

    return updates;
  });
}
