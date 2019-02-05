const co = require('co');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
const processWrite = require('./process-write');
const createOnAttributeWriteHandler = require('./on-attribute-write-handler');
const createOnWriteHandler = require('./on-write-handler');

const LOG_PREFIX = 'inspections:';

module.exports = {
 /**
  * Sync templates with propertyTemplates and log
  * any orphaned records
  * @param  {String} topic
  * @param  {functions.pubsub} pubSub
  * @param  {firebaseAdmin.database} db
  * @return {functions.CloudFunction}
  */
  createPublishHandler(topic = '', pubSub, db) {
    const self = this;
    const logPrefix = `${LOG_PREFIX} onPublish: ${topic}:`;

    return pubSub
    .topic(topic)
    .onPublish(() => co(function *() {
      const updates = {};
      log.info(`${logPrefix} received ${Date.now()}`);

      const inspectionIds = yield adminUtils.fetchRecordIds(db, '/inspections');

      // No inspections in database
      if (!inspectionIds.length) {
        return updates;
      }

      var i, updatedInspectionProxies;

      // Sync inspection data to nested, propertyInspections, propertyInspectionsList,
      // completedInspections, & completedInspectionsList
      for (i = 0; i < inspectionIds.length; i++) {
        const updatedInspectionProxies = yield self._upsertOldInspectionProxies(db, inspectionIds[i]);

        if (updatedInspectionProxies) {
          updates[inspectionIds[i]] = true;
        }
      }

      // Log orphaned proxy inspections
      // const propertyIds = yield adminUtils.fetchRecordIds(db, '/properties');
      // var nestedInspIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/properties/${propertyId}/inspections`)));
      // nestedInspIds = flatten(nestedInspIds);
      // var propInspIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspections/${propertyId}/inspections`)));
      // propInspIds = flatten(propInspIds);
      // var propInspListIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspectionsList/${propertyId}/inspections`)));
      // propInspListIds = flatten(propInspListIds);
      // const completedInspIds = yield adminUtils.fetchRecordIds(db, '/completedInspections');
      // const completedInspListIds = yield adminUtils.fetchRecordIds(db, '/completedInspectionsList');
      //
      // const proxyInspectionIds = []
      //   .concat(nestedInspIds, propInspIds, propInspListIds, completedInspIds, completedInspListIds) // flatten
      //   .filter((inspId, index, arr) => arr.indexOf(inspId) === index); // unique only
      //
      // proxyInspectionIds
      //   .filter((inspId) => inspectionIds.indexOf(inspId) === -1) // find orphaned
      //   .forEach((orphanedId) => {
      //     if (nestedInspIds.includes(orphanedId)) {
      //       log.info(`${logPrefix} orphaned inspection proxy: /properties/*/inspections/${orphanedId}`);
      //     }
      //
      //     if (propInspIds.includes(orphanedId)) {
      //       log.info(`${logPrefix} orphaned inspection proxy: /propertyInspections/*/inspections/${orphanedId}`);
      //     }
      //
      //     if (propInspListIds.includes(orphanedId)) {
      //       log.info(`${logPrefix} orphaned inspection proxy: /propertyInspectionsList/*/inspections/${orphanedId}`);
      //     }
      //
      //     if (completedInspIds.includes(orphanedId)) {
      //       log.info(`${logPrefix} orphaned inspection proxy: /completedInspections/${orphanedId}`);
      //     }
      //
      //     if (completedInspListIds.includes(orphanedId)) {
      //       log.info(`${logPrefix} orphaned inspection proxy: /completedInspectionsList/${orphanedId}`);
      //     }
      //   });

      return updates;
    }));
  },

  /**
   * Create observer find outdated inspection
   * proxies and updated them
   * @param  {firebaseAdmin.database} db
   * @param  {String} inspectionId
   * @return {Promise} - resolve {Boolean} was sync performed
   */
  _upsertOldInspectionProxies(db, inspectionId) {
    const self = this;
    return co(function *() {
      const inspectionSnap = yield db.ref(`/inspections/${inspectionId}`).once('value');
      const inspectionData = inspectionSnap.val();

      if (!inspectionData || !inspectionData.updatedLastDate) {
        return false;
      }

      // Lookup mismatched `updatedLastDate` between inspection
      // and its' proxy records and trigger update
      // if any mismatch is found
      const inspectionUpdateDateSnaps = yield Promise.all([
        `/properties/${inspectionData.property}/inspections/${inspectionId}`,
        `/propertyInspections/${inspectionData.property}/inspections/${inspectionId}`,
        `/propertyInspectionsList/${inspectionData.property}/inspections/${inspectionId}`,
        `/completedInspections/${inspectionId}`,
        `/completedInspectionsList/${inspectionId}`
      ].map((path) => db.ref(`${path}/updatedLastDate`).once('value')));

      // Filter out existing, up to date, inspection proxies
      const outdatedInspectionCount = inspectionUpdateDateSnaps.filter((dateSnap) =>
        !dateSnap.exists() || dateSnap.val() !== inspectionData.updatedLastDate
      ).length;

      if (outdatedInspectionCount > 0) {
        // Discovered outdated proxy(ies) perform sync
        yield self.processWrite(db, inspectionId, inspectionData);
        return true;
      }

      return false;
    });
  },

  processWrite,
  createOnAttributeWriteHandler,
  createOnWriteHandler
};

function flatten(arr) {
  return [].concat.apply([], arr);
}
