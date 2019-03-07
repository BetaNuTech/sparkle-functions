const s3Config = require('./s3.json');

const env = (process.env.NODE_ENV || 'production');

if (env === 'development' || env === 'test') {
  // development settings
} else {
  // Production (default) settings
}

s3Config.accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
s3Config.secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;

module.exports = Object.assign(
  {env},
  {s3: s3Config}
);
