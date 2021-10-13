const assert = require('assert');

/**
 * Format full name
 * @param  {Object} user
 * @return {String}
 */
module.exports = function getFullName(user) {
  assert(user && typeof user === 'object', 'has user object');
  return [`${user.firstName || ''}`.trim(), `${user.lastName || ''}`.trim()]
    .map(s => s.slice(0, 1).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
    .trim();
};
