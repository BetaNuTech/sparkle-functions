const processPropertyMeta = require('../../properties/process-meta');
const propertyInspectionsList = require('./property-inspections-list');
const completedInspectionsList = require('./completed-inspections-list');
const { isInspectionWritable } = require('./utils');

const LOG_PREFIX = 'inspections: process-write:';

/**
 * Perform update of all inspection proxies: nested,
 * propertyInspectionsList and completedInspectionsList
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function processWrite(db, inspectionId, inspection) {
  const updates = {};

  // Throw errors if inspection
  // cannot write a proxies
  await isInspectionWritable(db, inspection, LOG_PREFIX);

  // Update property inspections proxy
  await propertyInspectionsList({
    db,
    inspectionId,
    inspection,
  });
  updates[
    `/propertyInspectionsList/${inspection.property}/inspections/${inspectionId}`
  ] = 'upserted';

  // Upsert / remove completed inspections proxy
  const addedCompleted = await completedInspectionsList({
    db,
    inspectionId,
    inspection,
  });

  if (addedCompleted) {
    updates[`/completedInspectionsList/${inspectionId}`] = addedCompleted;
  } else {
    updates[`/completedInspectionsList/${inspectionId}`] = 'removed';
  }

  // Update property attributes related
  // to completed inspection meta data
  const metaUpdates = await processPropertyMeta(db, inspection.property);
  Object.assign(updates, metaUpdates); // combine updates

  return updates;
};
