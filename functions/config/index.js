const s3Config = require('./s3');
const inspectionItems = require('./inspection-items');
const deficientItems = require('./deficient-items');
const firebaseConfig = require('./firebase');
const slackApp = require('./slack-app');
const clientApps = require('./client-apps');
const cobalt = require('./cobalt');
const notifications = require('./notifications');
const globalApi = require('./global-api');
const jobs = require('./jobs');
const bids = require('./bids');
const models = require('./models');

const env = process.env.NODE_ENV || 'production';

if (env === 'development') {
  // Development settings
} else if (env === 'test') {
  // Test settings
} else {
  // Production (default) settings
}

module.exports = Object.assign(
  { env },
  { s3: s3Config },
  { inspectionItems },
  { deficientItems },
  { slackApp },
  { firebase: firebaseConfig },
  { clientApps },
  { cobalt },
  { notifications },
  { globalApi },
  { jobs },
  { bids },
  { models }
);
