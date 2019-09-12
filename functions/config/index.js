const s3Config = require('./s3.json');
const inspectionItems = require('./inspection-items');
const deficientItems = require('./deficient-items');
const firebaseConfig = require('./firebase');
const slackApp = require('./slack-app');
const clientApps = require('./client-apps');

const env = process.env.NODE_ENV || 'production';

if (env === 'development') {
  // Development settings
} else if (env === 'test') {
  // Test settings
} else {
  // Production (default) settings
}

s3Config.accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
s3Config.secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;

module.exports = Object.assign(
  { env },
  { s3: s3Config },
  { inspectionItems },
  { deficientItems },
  { slackApp },
  { firebase: firebaseConfig },
  { clientApps }
);
