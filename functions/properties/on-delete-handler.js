const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'properties: on-delete:';

/**
 * Factory for property on delete handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onDelete handler
 */
module.exports = function createOnDeleteHandler(db) {
  return (propertySnap, event) => co(function *() {
    const { propertyId } = event.params;

    log.info(`${LOG_PREFIX} property ${propertyId} deleted`);
    yield propertyTemplates.removeForProperty(db, propertyId);

    // Remove all property template proxies
    return {
      [`/propertyTemplates/${propertyId}`]: 'removed',
      [`/propertyTemplatesList/${propertyId}`]: 'removed'
    };
  });
}
