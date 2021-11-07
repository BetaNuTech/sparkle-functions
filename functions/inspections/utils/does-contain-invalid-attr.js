const assert = require('assert');

/**
 * Check if payload contains non-updatable attributes
 * @param  {Object}
 * @return {Boolean}
 */
module.exports = update => {
  assert(update && typeof update === 'object', 'has update object');

  const keys = Object.keys(update);
  const attrs = ['items', 'sections'];

  return keys.some(key => !attrs.includes(key));
};
