const assert = require('assert');

/**
 * Assert that all model methods
 * return a firebase admin database reference
 * @param  {Object} target
 * @return {Proxy} - proxy to db handlers
 */
module.exports = target =>
  new Proxy(target, {
    apply(tar, thisArg, args) {
      assert(Boolean(args[0]), 'has firebase admin database reference');
      return tar.apply(thisArg, args);
    },
  });
