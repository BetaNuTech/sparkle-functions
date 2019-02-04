const log = require('../utils/logger');
const processWrite = require('./process-write');

const LOG_PREFIX = 'inspections: on-write:';

/**
 * Factory for inspection onWrite handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - inspection onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return (change, event) => {
    const objectId = event.params.objectId;
    const updates = {};

    // When the data is deleted.
    if (!change.after.exists()) {
      log.info(`${LOG_PREFIX} inspection deleted`);
      const inspection = change.before.val();
      const propertyKey = inspection.property;
      const requests = [];

      if (!propertyKey) {
        log.error(`${LOG_PREFIX} property key missing`);
        return Promise.resolve(updates);
      }

      if (inspection.inspectionCompleted) {
        updates[`/completedInspections/${objectId}`] = 'removed';
        updates[`/completedInspectionsList/${objectId}`] = 'removed';
        requests.push(
          db.ref(`/completedInspections/${objectId}`).remove(),
          db.ref(`/completedInspectionsList/${objectId}`).remove()
        );
      }

      updates[`/properties/${propertyKey}/inspections/${objectId}`] = 'removed'; // TODO #28
      updates[`/propertyInspections/${propertyKey}/inspections/${objectId}`] = 'removed';
      requests.push(
        db.ref(`/properties/${propertyKey}/inspections/${objectId}`).remove(), // TODO #28
        db.ref(`/propertyInspections/${propertyKey}/inspections/${objectId}`).remove()
      );

      return Promise.all(requests).then(() => updates);
    } else {
      var inspection = change.after.val();
      log.info(`${LOG_PREFIX} inspection created/updated updating proxy records`);
      return processWrite(db, objectId, inspection);
    }
  };
}
