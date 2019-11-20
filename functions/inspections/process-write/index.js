const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const processPropertyMeta = require('../../properties/utils/process-meta');
const { isInspectionWritable } = require('./utils');

const PREFIX = 'inspections: process-write:';

/**
 * Sync property meta and all inspection proxies.
 * Proxies include nested, propertyInspectionsList,
 * and completedInspectionsList
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function processWrite(db, inspectionId, inspection) {
  const updates = {};

  // Throw errors if inspection
  // cannot write a proxies
  await isInspectionWritable(db, inspection, PREFIX);

  // Update property inspections proxy
  try {
    const propertyProxyUpdate = await inspectionsModel.syncPropertyInspectionProxy(
      db,
      inspectionId,
      inspection
    );
    Object.assign(updates, propertyProxyUpdate);
  } catch (err) {
    log.error(
      `${PREFIX} processWrite: property inspection proxy failed | ${err}`
    );
  }

  // Upsert / remove completed inspections proxy
  try {
    const completedProxyUpdate = await inspectionsModel.syncCompletedInspectionProxy(
      db,
      inspectionId,
      inspection
    );

    Object.assign(updates, completedProxyUpdate);
  } catch (err) {
    log.error(
      `${PREFIX} processWrite: completed inspection proxy failed | ${err}`
    );
  }

  // Update property attributes related
  // to completed inspection meta data
  const metaUpdates = await processPropertyMeta(db, inspection.property);
  Object.assign(updates, metaUpdates); // combine updates

  return updates;
};
