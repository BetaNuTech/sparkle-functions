const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

/**
 * Log orphaned proxy inspections
 * NOTE: unused
 * @param  {firebaseAdmin.database} db
 * @param  {String} propertyId
 * @param  {String} logPrefix
 * @return {Promise}
 */
module.exports = async function logOrphanedProxies(db, propertyId, logPrefix) {
  const propertyIds = await adminUtils.fetchRecordIds(db, '/properties');
  var propInspIds = await Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspections/${propertyId}/inspections`)));
  propInspIds = flatten(propInspIds);
  var propInspListIds = await Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspectionsList/${propertyId}/inspections`)));
  propInspListIds = flatten(propInspListIds);
  const completedInspIds = await adminUtils.fetchRecordIds(db, '/completedInspections');
  const completedInspListIds = await adminUtils.fetchRecordIds(db, '/completedInspectionsList');

  const proxyInspectionIds = []
  .concat(propInspIds, propInspListIds, completedInspIds, completedInspListIds) // flatten
  .filter((inspId, index, arr) => arr.indexOf(inspId) === index); // unique only

  proxyInspectionIds
  .filter((inspId) => inspectionIds.indexOf(inspId) === -1) // find orphaned
  .forEach((orphanedId) => {
    if (propInspIds.includes(orphanedId)) {
      log.info(`${logPrefix} orphaned inspection proxy: /propertyInspections/*/inspections/${orphanedId}`);
    }

    if (propInspListIds.includes(orphanedId)) {
      log.info(`${logPrefix} orphaned inspection proxy: /propertyInspectionsList/*/inspections/${orphanedId}`);
    }

    if (completedInspIds.includes(orphanedId)) {
      log.info(`${logPrefix} orphaned inspection proxy: /completedInspections/${orphanedId}`);
    }

    if (completedInspListIds.includes(orphanedId)) {
      log.info(`${logPrefix} orphaned inspection proxy: /completedInspectionsList/${orphanedId}`);
    }
  });
}

function flatten(arr) {
  return [].concat.apply([], arr);
}
