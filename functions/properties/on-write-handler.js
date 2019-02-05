const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const findRemovedKeys = require('../utils/find-removed-keys');

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return (change, event) => co(function *() {
    const propertyId = event.params.objectId;

    // Property deleted
    if (change.before.exists() && !change.after.exists()) {
      log.info(`property ${propertyId} removed`);
      yield propertyTemplates.removeForProperty(db, propertyId);

      // Remove all property template proxies
      return {
        [`/propertyTemplates/${propertyId}`]: 'removed',
        [`/propertyTemplatesList/${propertyId}`]: 'removed'
      };
    }

    return propertyTemplates.processWrite(db, propertyId, change.after.val().templates);
  });
}
