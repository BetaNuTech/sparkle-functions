const path = require('path');
const dotenv = require('dotenv');

try {
  const cwd = process.cwd();

  // Consume any `.env` in cwd and/or 2 parent directories
  dotenv.config();
  dotenv.config({ path: path.resolve(`${cwd}/..`, '.env') });
  dotenv.config({ path: path.resolve(`${cwd}/../..`, '.env') });
} catch (err) {} // eslint-disable-line no-empty

const config = require('../config'); // eslint-disable-line
const { firebase: fbConfig } = config;
const admin = require('firebase-admin'); // eslint-disable-line
const defaultApp = admin.initializeApp(fbConfig, 'script');
const db = defaultApp.database(fbConfig.stagingDatabaseURL);
const test = require('firebase-functions-test')(fbConfig); // eslint-disable-line
const cloudFunctions = require('../index'); // eslint-disable-line
const auth = admin.auth();

module.exports = {
  admin,
  auth,
  db,
  test,
  cloudFunctions,
  config,
};
