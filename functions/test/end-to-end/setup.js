const fs = require('fs');
const {Storage} = require('@google-cloud/storage');
const AUTH_FILE_PATH = '../auth.json';

// Write firbase auth file from environment if non-existent
if (process.env.FIREBASE_FUNCTIONS_AUTH && !fs.existsSync(AUTH_FILE_PATH)) {
  fs.writeFileSync(AUTH_FILE_PATH, Buffer.from(process.env.FIREBASE_FUNCTIONS_AUTH, 'hex'));
}

const testConfig = {
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'test-sapphire-inspections-8a9e3.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3'
};
const test = require('firebase-functions-test')(testConfig, AUTH_FILE_PATH);
const sinon = require('sinon');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();
const db = admin.database();

// Stub admin.initializeApp & `database()` to avoid live data access
sinon.stub(admin, 'initializeApp').returns({ database: () => db });
Object.defineProperty(admin, 'database', { writable: true, value: () => db });

// Stup gCloud storage config
sinon.stub(functions, 'config').returns(testConfig);
const storage = new Storage(testConfig);

module.exports = {
  db,
  test,
  storage,
  createStorageBucket: () => new Promise((resolve, reject) => {
    storage.createBucket(testConfig)
  }),
  cloudFunctions: require('../../index')
}
