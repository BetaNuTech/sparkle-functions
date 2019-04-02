const assert = require('assert');
const log = require('../utils/logger');

const LOG_PREFIX = 'deficient-items: on-di-state-update:';

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, inspectionId, itemId } event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(inspectionId), 'has inspection ID');
    assert(Boolean(itemId), 'has item ID');

    log.info(`${LOG_PREFIX} property: ${propertyId} | inspection: ${inspectionId} | item: ${itemId}`);
  }
}
