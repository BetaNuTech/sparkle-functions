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
      var inspection = change.before.val();
      var propertyKey = inspection.property;

      if (!propertyKey) {
        log.error(`${LOG_PREFIX} property key missing`);
        return Promise.resolve(updates);
      }

      if (inspection.inspectionCompleted) {
        updates[`/completedInspections/${objectId}`] = 'removed';
        db.ref('/completedInspections').child(objectId).remove();
      }

      updates[`/properties/${propertyKey}/inspections/${objectId}`] = 'removed';
      db.ref('/properties').child(propertyKey).child('inspections').child(objectId).remove();  // Need to remove
      updates[`/propertyInspections/${propertyKey}/inspections/${objectId}`] = 'removed';
      return db.ref('/propertyInspections').child(propertyKey).child('inspections').child(objectId).remove()
      .then(() => updates);
    } else {
      var inspection = change.after.val();
      log.info(`${LOG_PREFIX} inspection created/updated updating proxy records`);
      return processWrite(db, objectId, inspection);
    }
  };
}
