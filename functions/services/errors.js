const assert = require('assert');
const { ErrorReporting } = require('@google-cloud/error-reporting');
const config = require('../config/firebase');

const PREFIX = 'services: errors:';
const errorReporter = new ErrorReporting({
  projectId: config.projectId,
  credentials: config.credentialJson,
});

module.exports = {
  /**
   * Publish a report to Google
   * Cloud's error reporting service
   * @param  {String} message
   * @return {Promise<void>}
   */
  report(message) {
    assert(message && typeof message === 'string');

    return new Promise((resolve, reject) => {
      errorReporter.report(message, err => {
        if (err) {
          return reject(Error(`${PREFIX} report: ${err}`));
        }

        resolve();
      });
    });
  },
};
