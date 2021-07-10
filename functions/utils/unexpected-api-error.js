const assert = require('assert');
const log = require('./logger');

/**
 * Factory for generic 500 error
 * @param {String} prefix
 * @param {Express.Response} res
 * @return {Function} - handler
 */
module.exports = function create500ErrorHandler(prefix, res) {
  assert(prefix && typeof prefix === 'string', 'has log prefix');
  assert(Boolean(res), 'has Express response instance');

  /**
   * Error handler
   * @param {Error} err
   * @param {String?} msg
   * @param {String?} userMsg
   */
  return (err, msg = '', userMsg = 'Unexpected failure, please try again') => {
    assert(err instanceof Error, 'has error instance');
    assert(typeof msg === 'string', 'has log message');
    assert(userMsg && typeof userMsg === 'string', 'has user message');
    log.error(`${prefix} ${msg}${msg ? ' ' : ''}| ${err}`);
    res.set('Content-Type', 'application/vnd.api+json');
    res.status(500).send({ errors: [{ detail: userMsg }] });
  };
};
