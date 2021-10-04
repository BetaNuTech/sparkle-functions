const assert = require('assert');

/**
 * check if payload contains non-updatable attributes
 * @param  {Object} update, update object that needs to be validated
 * @return {Boolean}, returns boolean if the object is valid or not
 */
module.exports = update => {
  assert(update && typeof update === 'object', 'has update');

  const keys = Object.keys(update);

  const attrs = ['items', 'sections'];

  return keys.some(key => !attrs.includes(key));
};
