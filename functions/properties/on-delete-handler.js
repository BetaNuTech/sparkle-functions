const co = require('co');
const log = require('../utils/logger');
const inspections = require('../inspections');
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
    const inspUpdates = yield inspections.removeForProperty(db, propertyId);
    yield propertyTemplates.removeForProperty(db, propertyId);

    // Remove all property template proxies
    return Object.assign({
      [`/propertyTemplates/${propertyId}`]: 'removed',
      [`/propertyTemplatesList/${propertyId}`]: 'removed'
    }, inspUpdates);
  });
}
