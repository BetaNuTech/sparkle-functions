const fs = require('fs');
const AUTH_FILE_PATH = '../auth.json';

// Write firbase auth file from environment if non-existent
if (process.env.FIREBASE_FUNCTIONS_AUTH && !fs.existsSync(AUTH_FILE_PATH)) {
  fs.writeFileSync(AUTH_FILE_PATH, Buffer.from(process.env.FIREBASE_FUNCTIONS_AUTH, 'hex'));
}

const testConfig = {
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'sapphire-inspections.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3'
};
const test = require('firebase-functions-test')(testConfig, AUTH_FILE_PATH);
const sinon = require('sinon');
const admin = require('firebase-admin');

admin.initializeApp(testConfig);
const db = admin.database();
const auth = admin.auth();
const storage = admin.storage();

// Stub admin.initializeApp & `database()` to avoid live data access
sinon.stub(admin, 'initializeApp').returns({ database: () => db });
Object.defineProperty(admin, 'database', { writable: true, value: () => db });
Object.defineProperty(admin, 'storage', { writable: true, value: () => storage });

module.exports = {
  db,
  auth,
  test,
  storage,
  cloudFunctions: require('../../index')
}
