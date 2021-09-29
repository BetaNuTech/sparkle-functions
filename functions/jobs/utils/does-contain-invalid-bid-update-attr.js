const assert = require('assert');

/**
 * // Check if payload contains non-updatable attributes
 * @param  {Object} update
 * @return {Boolean}
 */
module.exports = update => {
  assert(update && typeof update === 'object', 'has update');

  const keys = Object.keys(update);

  const attrs = [
    'vendor',
    'vendorDetails',
    'costMax',
    'costMin',
    'startAt',
    'completeAt',
    'state',
    'scope',
  ];

  return keys.some(key => !attrs.includes(key));
};
