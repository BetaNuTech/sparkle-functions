const co = require('co');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
const processWrite = require('./process-write');
const deleteUploads = require('./delete-uploads');
const cron = require('./cron');
const createOnAttributeWriteHandler = require('./on-attribute-write-handler');
const createOnWriteHandler = require('./on-write-handler');
const createOnDeleteHandler = require('./on-delete-handler');
const createOnGetPDFReportHandler = require('./on-get-pdf-report');

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

      var inspectionIds = [];

      // Fetch first inspection ID in database
      var lastInspectionId = yield db.ref('/inspections').orderByKey().limitToFirst(1).once('value');
      lastInspectionId = Object.keys(lastInspectionId.val())[0];

      // Has no inspections
      if (!lastInspectionId) {
        return updates;
      }

      do {
        // Load inspections 10 at a time
        var queuedInspections = yield db.ref('/inspections').orderByKey().startAt(lastInspectionId).limitToFirst(11).once('value');
        queuedInspections = queuedInspections.val();

        // Remove last itterations' last inspection
        // that's been already upserted
        if (inspectionIds.length > 0) {
          delete queuedInspections[lastInspectionId];
        }

        inspectionIds = Object.keys(queuedInspections);
        lastInspectionId = inspectionIds[inspectionIds.length - 1];

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
        // var propInspIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspections/${propertyId}/inspections`)));
        // propInspIds = flatten(propInspIds);
        // var propInspListIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspectionsList/${propertyId}/inspections`)));
        // propInspListIds = flatten(propInspListIds);
        // const completedInspIds = yield adminUtils.fetchRecordIds(db, '/completedInspections');
        // const completedInspListIds = yield adminUtils.fetchRecordIds(db, '/completedInspectionsList');
        //
        // const proxyInspectionIds = []
        //   .concat(propInspIds, propInspListIds, completedInspIds, completedInspListIds) // flatten
        //   .filter((inspId, index, arr) => arr.indexOf(inspId) === index); // unique only
        //
        // proxyInspectionIds
        //   .filter((inspId) => inspectionIds.indexOf(inspId) === -1) // find orphaned
        //   .forEach((orphanedId) => {
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
      } while (inspectionIds.length > 0);

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
        try {
          yield self.processWrite(db, inspectionId, inspectionData);
        } catch (e) {
          log.error(`${LOG_PREFIX} ${e}`);
        }
        return true;
      }

      return false;
    });
  },

  /**
   * Remove all inspections and inspection proxies for a property
   * @param  {firebaseAdmin.database} db
   * @param  {firebaseAdmin.storage} storage
   * @param  {String} propertyId
   * @return {Promise} - resolves {Object} hash of updates
   */
  removeForProperty(db, storage, propertyId) {
    const updates = Object.create(null);

    return co(function *() {
      const inspectionsSnap = yield db.ref('/inspections').orderByChild('property').equalTo(propertyId).once('value');
      const inspections = inspectionsSnap.val();
      const inspectionsIds = Object.keys(inspections);

      // Remove each inspections' items' uploads
      for (let i = 0; i < inspectionsIds.length; i++) {
        const inspId = inspectionsIds[i];

        try {
          const uploadUpdates = yield deleteUploads(db, storage, inspId);
          Object.assign(updates, uploadUpdates);
        } catch (e) {};
      }

      // Collect inspections to delete in `updates`
      inspectionsIds.forEach(inspectionId => {
        updates[`/inspections/${inspectionId}`] = null;
      });

      // Remove all `/propertyInspections`
      updates[`/propertyInspections/${propertyId}`] = null;

      // Remove all `/propertyInspectionsList`
      updates[`/propertyInspectionsList/${propertyId}`] = null;

      yield db.ref().update(updates);
      return updates;
    }).catch(e =>
      new Error(`${LOG_PREFIX} removeForProperty: ${e}`) // wrap error
    );
  },

  cron,
  processWrite,
  createOnAttributeWriteHandler,
  createOnWriteHandler,
  createOnDeleteHandler,
  createOnGetPDFReportHandler
};

function flatten(arr) {
  return [].concat.apply([], arr);
}
