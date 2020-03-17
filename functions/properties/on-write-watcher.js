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
    try {
      const updates = await propertyTemplates.processWrite(
        db,
        propertyId,
        change.after.val().templates
      );
      if (updates && Object.keys(updates).length) {
        log.info(`${PREFIX} property "${propertyId}" template list updated`);
      }
    } catch (err) {
      log.error(
        `${PREFIX} failed to update property "${propertyId}" template list | ${err}`
      );
      throw err;
    }

    // TODO: sync property updates to Firestore
  };
};
