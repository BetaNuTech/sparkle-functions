const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'properties: on-write:';

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return (change, event) => co(function *() {
    const updates = Object.create(null);
    const propertyId = event.params.objectId;

    // Property deleted
    if (!change.after.exists()) {
      return updates;
    }

    log.info(`${LOG_PREFIX} property ${propertyId} updated`);
    return propertyTemplates.processWrite(db, propertyId, change.after.val().templates);
  });
}
