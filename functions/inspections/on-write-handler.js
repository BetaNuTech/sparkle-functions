const log = require('../utils/logger');
const processWrite = require('./process-write');

const LOG_PREFIX = 'inspections: on-write:';

/**
 * Factory for inspection onWrite handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - inspection onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return async function onWriteHandler(change, event) {
    const { objectId: inspectionId } = event.params;

    // Inspection removed
    if (!change.after.exists()) {
      return;
    }

    log.info(`${LOG_PREFIX} inspection ${inspectionId} upserted`);

    let updates = {};
    try {
      updates = await processWrite(db, inspectionId, change.after.val());
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
    }

    return updates;
  };
}
