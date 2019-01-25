const co = require('co');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');

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

      // Sync inspection data to nested, propertyInspections, & completedInspections
      for (i = 0; i < inspectionIds.length; i++) {
        const updatedInspectionProxies = yield self._updateOldInspectionProxies(db, inspectionIds[i]);

        if (updatedInspectionProxies) {
          updates[inspectionIds[i]] = true;
        }
      }

      // Log orphaned proxy inspections
      const propertyIds = yield adminUtils.fetchRecordIds(db, '/properties');
      var nestedInspIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/properties/${propertyId}/inspections`)));
      nestedInspIds = flatten(nestedInspIds);
      var propInspIds = yield Promise.all(propertyIds.map((propertyId) => adminUtils.fetchRecordIds(db, `/propertyInspections/${propertyId}/inspections`)));
      propInspIds = flatten(propInspIds);
      const completedInspIds = yield adminUtils.fetchRecordIds(db, '/completedInspections');

      const proxyInspectionIds = []
        .concat(nestedInspIds, propInspIds, completedInspIds) // flatten
        .filter((inspId, index, arr) => arr.indexOf(inspId) === index); // unique only

      proxyInspectionIds
        .filter((inspId) => inspectionIds.indexOf(inspId) === -1) // find orphaned
        .forEach((orphanedId) => {
          if (nestedInspIds.indexOf(orphanedId) > -1) {
            log.info(`${logPrefix} orphaned inspection proxy: /properties/*/inspections/${orphanedId}`);
          }

          if (propInspIds.indexOf(orphanedId) > -1) {
            log.info(`${logPrefix} orphaned inspection proxy: /propertyInspections/*/inspections/${orphanedId}`);
          }

          if (completedInspIds.indexOf(orphanedId) > -1) {
            log.info(`${logPrefix} orphaned inspection proxy: /completedInspections/${orphanedId}`);
          }
        });

      return updates;
    }));
  },

  /**
   * Find outdated Inspection proxies and updated them
   * @param  {firebaseAdmin.database} db
   * @param  {String} inspectionId
   * @return {Promise} - resolve {Boolean} was sync performed
   */
  _updateOldInspectionProxies(db, inspectionId) {
    const self = this;
    return co(function *() {
      const inspectionSnap = yield db.ref(`/inspections/${inspectionId}`).once('value');
      const inspectionData = inspectionSnap.val();

      if (!inspectionData) {
        return false;
      }

      // Lookup mismatched `updatedLastDate` between inspection
      // and its' abbreviated proxy records and trigger update
      // if any mismatch is found
      const inspectionUpdateDateSnaps = yield Promise.all([
        `/properties/${inspectionData.property}/inspections/${inspectionId}`,
        `/propertyInspections/${inspectionData.property}/inspections/${inspectionId}`,
        `/completedInspections/${inspectionId}`
      ].map((path) => db.ref(`${path}/updatedLastDate`).once('value')));

      // Filter out non-existent, up to date, inspection proxies
      const outdatedInspectionCount = inspectionUpdateDateSnaps.filter((dateSnap) =>
        dateSnap.exists() && dateSnap.val() !== inspectionData.updatedLastDate
      ).length;

      if (outdatedInspectionCount > 0) {
        // Discovered outdated proxy(ies) perform sync
        yield self.processWrite(db, inspectionId, inspectionData);
        return true;
      }

      return false;
    });
  },

  /**
   * Perform update of all inspection proxies: nested,
   * propertyInspections, and completedInspections
   * @param  {firebaseAdmin.database} database
   * @param  {String} inspectionId
   * @param  {Object} inspection
   * @return {Promise} - resolves {Object} hash of updates
   */
  processWrite(database, inspectionId, inspection) {
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
      'inspector': inspection.inspector,
      'inspectorName': inspection.inspectorName,
      'creationDate': inspection.creationDate,
      'updatedLastDate': inspection.updatedLastDate,
      'templateName': templateName,
      'score': inspection.score,
      'deficienciesExist': inspection.deficienciesExist,
      'inspectionCompleted': inspection.inspectionCompleted,
      'itemsCompleted': inspection.itemsCompleted,
      'totalItems': inspection.totalItems
    };
    database.ref('/properties').child(propertyKey).child('inspections').child(inspectionId).set(inspectionData);  // Need to remove
    dbUpdates[`/properties/${propertyKey}/inspections/${inspectionId}`] = inspectionData;
    database.ref('/propertyInspections').child(propertyKey).child('inspections').child(inspectionId).set(inspectionData);
    dbUpdates[`/propertyInspections/${propertyKey}/inspections/${inspectionId}`] = inspectionData;

    if (inspection.inspectionCompleted) {
      const completedInspectionData = {
        'inspector': inspection.inspector,
        'inspectorName': inspection.inspectorName,
        'creationDate': inspection.creationDate,
        'updatedLastDate': inspection.updatedLastDate,
        'templateName': templateName,
        'score': inspection.score,
        'deficienciesExist': inspection.deficienciesExist,
        'inspectionCompleted': inspection.inspectionCompleted,
        'property': inspection.property
      };
      database.ref('/completedInspections').child(inspectionId).set(completedInspectionData);
      dbUpdates[`/completedInspections/${inspectionId}`] = completedInspectionData;
    } else {
      database.ref('/completedInspections').child(inspectionId).remove();
      dbUpdates[`/completedInspections/${inspectionId}`] = 'removed';
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
      database.ref('/properties').child(propertyKey).update({'numOfInspections': numOfInspectionsCompleted});
      dbUpdates[`/properties/${propertyKey}/numOfInspections`] = numOfInspectionsCompleted

      if (latestInspection) {
        var updates = {};
        updates['lastInspectionScore'] = latestInspection.score;
        updates['lastInspectionDate'] = latestInspection.creationDate;
        log.info('property lastInspectionScore & lastInspectionDate updated');
        database.ref('/properties').child(propertyKey).update(updates);
        dbUpdates[`/properties/${propertyKey}`] = updates;
      }
      return dbUpdates;
    }).catch(function(error) {
      // Handle any errors
      log.error('Unable to access inspections', error);
      return null;
    });
  }
};

function flatten(arr) {
  return [].concat.apply([], arr);
}
