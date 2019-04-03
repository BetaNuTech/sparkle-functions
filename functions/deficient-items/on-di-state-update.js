const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const processPropertyMeta = require('../properties/process-meta');

const LOG_PREFIX = 'deficient-items: on-di-state-update:';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, inspectionId, itemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(inspectionId), 'has inspection ID');
    assert(Boolean(itemId), 'has item ID');

    log.info(`${LOG_PREFIX} property: ${propertyId} | inspection: ${inspectionId} | item: ${itemId}`);

    const beforeStateRequired = REQUIRED_ACTIONS_VALUES.includes(change.before.val());
    const afterStateRequired = REQUIRED_ACTIONS_VALUES.includes(change.after.val());

    // Action required action status changed
    if (beforeStateRequired !== afterStateRequired) {
      await processPropertyMeta(db, propertyId);
      log.info(`${LOG_PREFIX} updated property: ${propertyId} deficient items associated metadata`);
    }

    return updates;
  }
}
