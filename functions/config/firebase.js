const fs = require('fs');
const appRoot = require('app-root-path');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const PREFIX = 'config: firebase: ';
const AUTH_FILE_PATH = `${appRoot}/../auth.json`;

let config = null;
const firebaseConfig = functions.config() || {};

try {
  // Get auth file from environment if non-existent
  let serviceAccount;
  const firebaseAuthHex = firebaseConfig.auth
    ? firebaseConfig.auth.firebase
    : process.env.FIREBASE_FUNCTIONS_AUTH;
  if (fs.existsSync(AUTH_FILE_PATH)) {
    serviceAccount = require(AUTH_FILE_PATH); // eslint-disable-line import/no-dynamic-require,global-require
  } else if (firebaseAuthHex) {
    serviceAccount = JSON.parse(Buffer.from(firebaseAuthHex, 'hex').toString());
  } else {
    throw Error('Service account not configured');
  }

  if (process.env.FIREBASE_CONFIG) {
    config = JSON.parse(process.env.FIREBASE_CONFIG);
  } else {
    config = {
      projectId: serviceAccount.project_id,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    };

    if (process.env.NODE_ENV === 'production') {
      // Production database must be specifically requested
      config.databaseURL = process.env.FIREBASE_DB_URL;
    } else {
      // Default database to test
      config.databaseURL = process.env.FIREBASE_TEST_DB_URL;
    }
  }

  // Add service account crentials to config
  config.credential = admin.credential.cert(serviceAccount);

  // Limit full access of FB admin
  // forcing adherance to database rules
  config.databaseAuthVariableOverride = { uid: serviceAccount.client_id };
} catch (err) {
  throw Error(`${PREFIX}: ${err}`);
}

module.exports = config;
