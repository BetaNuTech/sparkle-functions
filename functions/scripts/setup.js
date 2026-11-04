const path = require('path');
const dotenv = require('dotenv');

try {
  const cwd = process.cwd();
  const envFile = process.env.ENV_FILE || '.env';

  // Consume any `.env` in cwd and/or 2 parent directories
  dotenv.config({ path: `${cwd}/${envFile}` });
  dotenv.config({ path: path.resolve(`${cwd}/..`, envFile) });
  dotenv.config({ path: path.resolve(`${cwd}/../..`, envFile) });
} catch (err) {} // eslint-disable-line no-empty

const config = require('../config'); // eslint-disable-line
const { firebase: fbConfig } = config;
const { initializeApp } = require('firebase-admin/app'); // eslint-disable-line
const { getFirestore } = require('firebase-admin/firestore'); // eslint-disable-line
const { getAuth } = require('firebase-admin/auth'); // eslint-disable-line
const { getStorage } = require('firebase-admin/storage'); // eslint-disable-line

const scriptApp = initializeApp(fbConfig, 'script');
const db = getFirestore(scriptApp);
const test = require('firebase-functions-test')(fbConfig); // eslint-disable-line
const cloudFunctions = require('../index'); // eslint-disable-line
const auth = getAuth(); // default app, initialized by ../index
const storage = getStorage();

module.exports = {
  auth,
  db,
  test,
  cloudFunctions,
  config,
  uid: config.firebase.databaseAuthVariableOverride.uid,
  storage,
};
