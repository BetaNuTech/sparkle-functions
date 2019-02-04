const log = require('../utils/logger');

/**
 * Perform update of all inspection proxies: nested,
 * propertyInspections, and completedInspections
 * @param  {firebaseAdmin.database} database
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = function processWrite(database, inspectionId, inspection) {
  var propertyKey = inspection.property;
  const dbUpdates = {};

  if (!propertyKey) {
    log.error('processUpdatedInspection: property key missing');
    return Promise.resolve(dbUpdates);
  }

  var templateName = inspection.templateName;
  if (!templateName) {
    templateName = inspection.template.name;
  }

  // Update property/inspections
  var inspectionData = {
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
  database.ref(`/properties/${propertyKey}/inspections/${inspectionId}`).set(inspectionData);  // Need to remove
  dbUpdates[`/properties/${propertyKey}/inspections/${inspectionId}`] = inspectionData;
  database.ref(`/propertyInspections/${propertyKey}/inspections/${inspectionId}`).set(inspectionData);
  database.ref(`/propertyInspectionsList/${propertyKey}/inspections/${inspectionId}`).set(inspectionData);
  dbUpdates[`/propertyInspections/${propertyKey}/inspections/${inspectionId}`] = inspectionData;
  dbUpdates[`/propertyInspectionsList/${propertyKey}/inspections/${inspectionId}`] = inspectionData;

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
    database.ref(`/completedInspections/${inspectionId}`).set(completedInspectionData);
    database.ref(`/completedInspectionsList/${inspectionId}`).set(completedInspectionData);
    dbUpdates[`/completedInspections/${inspectionId}`] = completedInspectionData;
    dbUpdates[`/completedInspectionsList/${inspectionId}`] = completedInspectionData;
  } else {
    database.ref(`/completedInspections/${inspectionId}`).remove();
    database.ref(`/completedInspectionsList/${inspectionId}`).remove();
    dbUpdates[`/completedInspections/${inspectionId}`] = 'removed';
    dbUpdates[`/completedInspectionsList/${inspectionId}`] = 'removed';
  }

  // Pull all inspections for the same property
  return database.ref('/inspections').orderByChild('property').equalTo(propertyKey).once('value').then(inspectionsSnapshot => {
    var latestInspection;
    var numOfInspectionsCompleted = 0;
    if (!inspectionsSnapshot.exists()) {
      return dbUpdates;
    } else if (inspectionsSnapshot.hasChildren()) {
      var inspections = [];
      inspectionsSnapshot.forEach(function(childSnapshot) {
        // key will be 'ada' the first time and 'alan' the second time
        var inspection = childSnapshot.val();
        // childData will be the actual contents of the child
        //var childData = childSnapshot.val();
        if (inspection.inspectionCompleted) {
          inspections.push(inspection);
          numOfInspectionsCompleted++;
        }
      });

      if (inspections.length > 0) {
        var sortedInspections = inspections.sort(function(a,b) { return b.creationDate-a.creationDate });  // DESC
        latestInspection = sortedInspections[0];
      }
    } else {
      var inspection = inspectionsSnapshot.val();
      if (inspection.inspectionCompleted) {
        latestInspection = inspection;
        numOfInspectionsCompleted++;
      }
    }

    // Update numOfInspections for the property
    log.info('property numOfInspections updated');
    database.ref(`/properties/${propertyKey}`).update({'numOfInspections': numOfInspectionsCompleted});
    dbUpdates[`/properties/${propertyKey}/numOfInspections`] = numOfInspectionsCompleted

    if (latestInspection) {
      var updates = {};
      updates['lastInspectionScore'] = latestInspection.score;
      updates['lastInspectionDate'] = latestInspection.creationDate;
      log.info('property lastInspectionScore & lastInspectionDate updated');
      database.ref(`/properties/${propertyKey}`).update(updates);
      dbUpdates[`/properties/${propertyKey}`] = updates;
    }
    return dbUpdates;
  }).catch(function(error) {
    // Handle any errors
    log.error('Unable to access inspections', error);
    return null;
  });
}
