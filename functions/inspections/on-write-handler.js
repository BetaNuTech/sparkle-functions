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
    const { objectId } = event.params;

    // Inspection added/updated
    if (change.after.exists()) {
      const inspection = change.after.val();
      log.info(`${LOG_PREFIX} inspection ${objectId} upserted`);
      return processWrite(db, objectId, inspection);
    }
  };
}
