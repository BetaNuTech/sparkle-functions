const co = require('co');
const log = require('../utils/logger');
const processWrite = require('./process-write');

const LOG_PREFIX = 'inspections: on-attribute-write:';

/**
 * Factory for general inspection updated onWrite handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - inspection attribute onWrite handler
 */
module.exports = function createOnAttributeWriteHandler(db) {
  return (change, event) => co(function *() {
    const updates = {};
    const objectId = event.params.objectId;

    // Inspection deleted or already up to date
    if (!change.after.exists() || change.before.val() === change.after.val()) {
      return updates;
    }

    try {
      const inspectionSnapshot = yield change.after.ref.parent.once('value');

      if (!inspectionSnapshot.exists()) {
        log.info(`${LOG_PREFIX} ${objectId} no inspection record found`);
        return updates;
      }

      log.info(`${LOG_PREFIX} ${objectId} updated, migrating proxy inspections`);
      return processWrite(db, objectId, inspectionSnapshot.val());
    } catch(error) {
      // Handle any errors
      log.error(`${LOG_PREFIX} ${objectId} failed to migrate updated inspection ${error}`);
      return updates;
    }
  });
}
