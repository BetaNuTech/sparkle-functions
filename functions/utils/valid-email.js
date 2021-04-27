const assert = require('assert');

/**
 * Is a valid email string
 * @param  {String} email
 * @return {Boolean}
 */
module.exports = function validEmail(email) {
  assert(email && typeof email === 'string', 'has email string');
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // eslint-disable-line no-useless-escape
  return re.test(String(email).toLowerCase());
};
