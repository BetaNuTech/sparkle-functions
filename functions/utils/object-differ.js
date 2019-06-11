const assert = require('assert');

module.exports = {
  /**
   * Get differences between two object
   * @param  {Object} src
   * @param  {Object} dest
   * @param  {Object?} attrs - key of attributes to diff
   * @return {Object} - diff object
   */
  getDiffs(src = {}, dest = {}, attrs = []) {
    assert(src && typeof src === 'object', 'has source object');
    assert(dest && typeof dest === 'object', 'has destination object');

    const updates = Object.create(null);

    if (!Array.isArray(attrs) || attrs.length === 0) {
      attrs = Object.keys(src); // diff all of source
    }

    attrs
      .filter(attr => Boolean(src[attr])) // Ignore falsey source values
      .filter(attr => diff(src[attr], dest[attr])) // different attrs only
      .forEach(attr => {
        const srcValue = src[attr];
        if (typeof srcValue === 'object') {
          return (updates[attr] = JSON.parse(JSON.stringify(srcValue)));
        }
        return (updates[attr] = srcValue);
      });

    return updates;
  },

  diff,
};

/**
 * Determine if two values are different
 * @param  {Any} a
 * @param  {Any} b
 * @return {Boolean}
 */
function diff(a, b) {
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b); // deep equal
  }
  return a !== b;
}
