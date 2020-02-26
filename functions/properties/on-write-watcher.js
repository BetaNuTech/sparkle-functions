const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'properties: on-write:';

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return async (change, event) => {
    const updates = {};
    const { propertyId } = event.params;

    if (!propertyId) {
      log.warn(
        `${LOG_PREFIX} incorrectly defined event parameter "propertyId"`
      );
      return;
    }

    // Property deleted
    if (!change.after.exists()) {
      return updates;
    }

    // Sync property updates to property template proxies
    const propTemplUpdates = await propertyTemplates.processWrite(
      db,
      propertyId,
      change.after.val().templates
    );
    log.info(`${LOG_PREFIX} property ${propertyId} updated`);
    Object.assign(updates, propTemplUpdates); // add proxy updates

    return updates;
  };
};
