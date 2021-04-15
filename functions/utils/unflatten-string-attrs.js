const assert = require('assert');

/**
 * Convert firestore compatible
 * "write.attributes" into merged
 * nested objects
 * @param   {Object} obj
 * @return  {Object}
 */
module.exports = function unflattenStringAttrs(obj = {}) {
  assert(obj && typeof obj === 'object', 'has object');

  const result = JSON.parse(JSON.stringify(obj));

  return Object.keys(obj).reduce((acc, attr) => {
    const pathSegments = attr.split('.');
    if (pathSegments.length === 1) return acc;

    // Rewrite path as object tree
    appendSegment(acc, obj[attr], pathSegments);
    delete acc[attr];

    return acc;
  }, result);
};

/**
 * Append each path segment
 * as a nested tree of objects
 * NOTE: Creates side effects on `obj`
 * @param   {Object} obj
 * @param   {Any} payload
 * @param   {String[]} paths
 * @return  {Object}
 */
function appendSegment(obj, payload, paths) {
  assert(obj && typeof obj === 'object', 'has object');
  assert(typeof payload !== 'undefined', 'has defined payload');
  assert(paths && Array.isArray(paths), 'has paths array');
  assert(
    paths.every(path => path && typeof path === 'string'),
    'has paths contains only strings'
  );

  if (paths.length > 1) {
    const segment = paths.shift();
    obj[segment] = {};
    return appendSegment(obj[segment], payload, paths);
  }

  obj[paths.shift()] = payload;
  return obj;
}
