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
    const updates = Object.create(null);
    const { inspectionId } = event.params;

    if (!inspectionId) {
      log.warn(
        `${LOG_PREFIX} incorrectly defined event parameter "inspectionId"`
      );
      return;
    }

    // Inspection removed
    if (!change.after.exists()) {
      return updates;
    }

    try {
      const processWriteUpdates = await processWrite(
        db,
        inspectionId,
        change.after.val()
      );
      log.info(`${LOG_PREFIX} inspection ${inspectionId} upserted`);
      Object.assign(updates, processWriteUpdates);
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
    }

    return updates;
  };
};
