const AWS = require('aws-sdk');
const CONFIG = require('../config');

const PREFIX = 'utils: s3-client:';

const target = new AWS.S3({
  region: 'USEast2',
  endpoint: CONFIG.s3.endpoint,
  accessKeyId: CONFIG.s3.accessKeyId,
  secretAccessKey: CONFIG.s3.secretAccessKey,
});

/**
 * Defer logging of configuration
 * errors until S3 Client methods
 * are invoked by consumer
 * @type {Proxy}
 */
module.exports = new Proxy(target, {
  get(...args) {
    if (CONFIG.s3.accessKeyId && CONFIG.s3.secretAccessKey) {
      return Reflect.get(...args);
    }

    throw new Error(`${PREFIX} AWS S3 client not configured`);
  },
});
