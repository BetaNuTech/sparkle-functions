const assert = require('assert');

/**
 * Create a state history instance
 * from a deficiency item
 * @param  {Object} diItem - deficiency item instance
 * @param  {Object} options - optional configuration
 * @return {Object} - stateHistory
 */
module.exports = function createStateHistory(idItem, options = {}) {
  assert(idItem && typeof idItem === 'object', 'has deficient item instance');
  assert(options && typeof options === 'object', 'has options');

  const { currentStartDate, state } = idItem;
  const { createdAt = Date.now() / 1000, user } = options;

  assert(state && typeof state === 'string', 'has DI with "state" string');
  assert(currentStartDate && typeof currentStartDate === 'number', 'has DI with "currentStartDate" unix timestamp');
  assert(createdAt && typeof createdAt === 'number', 'has "createdAt" unix timestamp ');

  const result = { state, startDate: currentStartDate, createdAt };

  if (user) {
    // Add optional user to history state
    assert(typeof user === 'string', 'has "user" ID reference');
    result.user = user;
  }

  return result;
}
