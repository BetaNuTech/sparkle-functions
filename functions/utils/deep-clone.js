/**
 * Deeply clone an object and
 * return the copy
 * @param  {Object|Array} src
 * @return {Object|Array}
 */
module.exports = function deepClone(src) {
  if (!src && typeof src !== 'object') {
    throw TypeError('deepClone requires an object or array');
  }

  return JSON.parse(JSON.stringify(src));
};
