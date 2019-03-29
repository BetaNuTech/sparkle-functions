const log = require('../utils/logger');

const LOG_PREFIX = 'inspections: process-property-meta:';

/**
 * Process changes to a property's metadata when it's
 * completed inspections' chanages
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {String} propertyId
 * @return {Promise} - resolves {Object} updates
 */
module.exports = async function processMeta(db, propertyId) {
  const updates = Object.create(null);

  // Pull all inspections for the same property
  const inspectionsSnapshot = await db.ref('/inspections').orderByChild('property').equalTo(propertyId).once('value');

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
    await db.ref(`/properties/${propertyId}/numOfInspections`).set(numOfInspectionsCompleted);
    log.info(`${LOG_PREFIX} property ${propertyId}: numOfInspections updated`);
    updates[`/properties/${propertyId}/numOfInspections`] = 'updated';

    if (latestInspection) {
      await db.ref(`/properties/${propertyId}`).update({
        lastInspectionScore: latestInspection.score,
        lastInspectionDate: latestInspection.creationDate
      });

      log.info(`${LOG_PREFIX} property ${propertyId}: lastInspectionScore & lastInspectionDate updated`);
      updates[`/properties/${propertyId}/lastInspectionScore`] = 'updated';
      updates[`/properties/${propertyId}/lastInspectionDate`] = 'updated';
    }
  } catch(e) {
    log.error(`${LOG_PREFIX} property ${propertyId}: Unable to access inspections ${e}`);
    return null;
  }

  return updates;
}
