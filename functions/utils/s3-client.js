const AWS = require('aws-sdk');
const CONFIG = require('../config');
const log = require('./logger');

const LOG_PREFIX = 'utils: s3-client:';

if (!CONFIG.s3.accessKeyId) {
  log.error(
    `${LOG_PREFIX} "AWS_S3_ACCESS_KEY_ID" not configured for AWS S3 Uploads`
  );
}

if (!CONFIG.s3.secretAccessKey) {
  log.error(
    `${LOG_PREFIX} "AWS_S3_SECRET_ACCESS_KEY" not configured for AWS S3 Uploads`
  );
}

module.exports = new AWS.S3({
  region: 'USEast2',
  endpoint: CONFIG.s3.endpoint,
  accessKeyId: CONFIG.s3.accessKeyId,
  secretAccessKey: CONFIG.s3.secretAccessKey
});
