const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const PREFIX = 'properties: on-write:';

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return async (change, event) => {
    const { propertyId } = event.params;

    if (!propertyId) {
      log.error(`${PREFIX} incorrectly defined event parameter "propertyId"`);
      return;
    }

    // Property deleted
    if (!change.after.exists()) {
      return;
    }

    // Sync property updates to property template proxies
    await propertyTemplates.processWrite(
      db,
      propertyId,
      change.after.val().templates
    );
    log.info(`${PREFIX} property "${propertyId}" template list updated`);

    // TODO: sync property updates to Firestore
  };
};
