const assert = require('assert');
const config = require('../../config/deficient-items');

const DI_ENUM_STATES = config.allStates;
const PREMISSIONED_TRANSITIONS = config.permissionedTransitionStates;

/**
 * Does user have permission to transition
 * to the given deficient item state
 * @param  {Object} user
 * @param  {string} state
 * @return {Boolean}
 */
module.exports = (user, state) => {
  assert(user && typeof user === 'object', 'has user record');
  assert(DI_ENUM_STATES.includes(state), 'has valid deficient item state');

  if (PREMISSIONED_TRANSITIONS.includes(state)) {
    return Boolean(user.admin || user.corporate);
  }

  return true;
};
