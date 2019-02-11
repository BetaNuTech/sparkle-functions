const co = require('co');
const log = require('../utils/logger');

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

    // Update property/inspections
    const inspectionData = {
      inspector: inspection.inspector,
      inspectorName: inspection.inspectorName,
      creationDate: inspection.creationDate,
      updatedLastDate: inspection.updatedLastDate,
      templateName: templateName,
      score: inspection.score,
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
        inspector: inspection.inspector,
        inspectorName: inspection.inspectorName,
        creationDate: inspection.creationDate,
        updatedLastDate: inspection.updatedLastDate,
        templateName: templateName,
        score: inspection.score,
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

    // Pull all inspections for the same property
    const inspectionsSnapshot = yield db.ref('/inspections').orderByChild('property').equalTo(propertyId).once('value');

    if (!inspectionsSnapshot.exists()) {
      return updates;
    }

    try {
      var latestInspection = null;
      var latestInspectionTmp = null;
      var numOfInspectionsCompleted = 0;
      const inspections = [];

      if (inspectionsSnapshot.hasChildren()) {
        inspectionsSnapshot.forEach((childSnapshot) => {
          // key will be 'ada' the first time and 'alan' the second time
          latestInspectionTmp = childSnapshot.val();

          // childData will be the actual contents of the child
          //var childData = childSnapshot.val();
          if (latestInspectionTmp.inspectionCompleted) {
            inspections.push(latestInspectionTmp);
            numOfInspectionsCompleted++;
          }
        });

        if (inspections.length) {
          latestInspection = inspections.sort((a, b) => b.creationDate - a.creationDate)[0]; // DESC
        }
      } else {
        latestInspectionTmp = inspectionsSnapshot.val();

        if (latestInspectionTmp.inspectionCompleted) {
          latestInspection = latestInspectionTmp;
          numOfInspectionsCompleted++;
        }
      }

      // Update `numOfInspections` for the property
      yield db.ref(`/properties/${propertyId}/numOfInspections`).set(numOfInspectionsCompleted);
      log.info(`${LOG_PREFIX} property numOfInspections updated`);
      updates[`/properties/${propertyId}/numOfInspections`] = 'updated';

      if (latestInspection) {
        yield db.ref(`/properties/${propertyId}`).update({
          lastInspectionScore: latestInspection.score,
          lastInspectionDate: latestInspection.creationDate
        });

        log.info(`${LOG_PREFIX} property lastInspectionScore & lastInspectionDate updated`);
        updates[`/properties/${propertyId}/lastInspectionScore`] = 'updated';
        updates[`/properties/${propertyId}/lastInspectionDate`] = 'updated';
      }
    } catch(error) {
      log.error(`${LOG_PREFIX} Unable to access inspections ${error}`);
      return null;
    }

    return updates;
  });
}
