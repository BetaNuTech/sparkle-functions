// const compose = require('lodash/fp/compose');
const processPropertyMeta = require('../process-property-meta');
const propertyInspectionsList = require('./property-inspections-list');
const completedInspectionsList = require('./completed-inspections-list');

const LOG_PREFIX = 'inspections: process-write:';

/**
 * Perform update of all inspection proxies: nested,
 * propertyInspections, and completedInspections
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function processWrite(db, inspectionId, inspection) {
  const updates = {};

  if (!inspection.property) {
    throw new Error(`${LOG_PREFIX} property relationship missing`);
  }

  // Stop if inspection dead (belongs to archived property)
  const propertySnap = await db.ref(`/properties/${inspection.property}`).once('value');
  if (!propertySnap.exists()) {
    throw new Error(`${LOG_PREFIX} inspection belongs to archived property`);
  }

  const templateName = inspection.templateName || inspection.template.name;
  const score = inspection.score && typeof inspection.score === 'number' ? inspection.score : 0;

  // Update property inspections proxy
  await propertyInspectionsList({
    db,
    inspectionId,
    inspection,
    score,
    templateName
  });
  updates[`/propertyInspections/${inspection.property}/inspections/${inspectionId}`] = 'upserted'; // TODO remove #53
  updates[`/propertyInspectionsList/${inspection.property}/inspections/${inspectionId}`] = 'upserted';

  // Upsert / remove completed inspections proxy
  const addedCompleted = await completedInspectionsList({
    db,
    inspectionId,
    templateName,
    inspection,
    score
  });

  if (addedCompleted) {
    updates[`/completedInspections/${inspectionId}`] = addedCompleted; // TODO remove #53
    updates[`/completedInspectionsList/${inspectionId}`] = addedCompleted;
  } else {
    updates[`/completedInspections/${inspectionId}`] = 'removed'; // TODO remove #53
    updates[`/completedInspectionsList/${inspectionId}`] = 'removed';
  }

  // Update property attributes related
  // to completed inspection meta data
  const metaUpdates = await processPropertyMeta(db, inspection.property);
  Object.assign(updates, metaUpdates); // combine updates

  return updates;
}
