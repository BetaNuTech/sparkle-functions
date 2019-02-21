const co = require('co');
const log = require('../utils/logger');
const inspections = require('../inspections');
const propertyTemplates = require('../property-templates');
const LOG_PREFIX = 'properties: on-delete:';
const PROPERTY_BUCKET_NAME = `propertyImages${process.env.NODE_ENV === 'test' ? 'Test' : ''}`;

/**
 * Factory for property on delete handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage}  - Firebase Admin Storage instance
 * @return {Function} - property onDelete handler
 */
module.exports = function createOnDeleteHandler(db, storage) {
  return (propertySnap, event) => co(function *() {
    const { propertyId } = event.params;

    log.info(`${LOG_PREFIX} property ${propertyId} deleted`);
    const inspUpdates = yield inspections.removeForProperty(db, propertyId);
    yield propertyTemplates.removeForProperty(db, propertyId);

    // Cleanup deleted property's profile image
    try {
      const property = propertySnap.val();
      if (property && property.photoURL) {
        const fileName = (decodeURIComponent(property.photoURL).split('?')[0] || '').split('/').pop();
        yield storage.bucket().file(`${PROPERTY_BUCKET_NAME}/${fileName}`).delete();
        log.info(`${LOG_PREFIX} property ${propertyId} profile image removal succeeded`);
      }
    } catch (e) {
      log.error(`${LOG_PREFIX} property ${propertyId} profile image removal failed ${e}`);
    }

    // Remove all property template proxies
    return Object.assign({
      [`/propertyTemplates/${propertyId}`]: 'removed',
      [`/propertyTemplatesList/${propertyId}`]: 'removed'
    }, inspUpdates);
  });
}
