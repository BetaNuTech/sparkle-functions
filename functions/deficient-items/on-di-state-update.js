const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const processPropertyMeta = require('../properties/process-meta');

const LOG_PREFIX = 'deficient-items: on-di-state-update:';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, itemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(itemId), 'has item ID');

    log.info(`${LOG_PREFIX} property: ${propertyId} | item: ${itemId}`);

    const beforeState = change.before.val();
    const afterState = change.after.val();
    const stillRequiresAction = REQUIRED_ACTIONS_VALUES.includes(beforeState) && REQUIRED_ACTIONS_VALUES.includes(afterState);
    const stillFollowUpAction = FOLLOW_UP_ACTION_VALUES.includes(beforeState) && FOLLOW_UP_ACTION_VALUES.includes(afterState);

    // Action required action status changed
    if (!stillRequiresAction && !stillFollowUpAction && beforeState !== afterState) {
      await processPropertyMeta(db, propertyId);
      log.info(`${LOG_PREFIX} updated property: ${propertyId} deficient items associated metadata`);
    }

    return updates;
  }
}
