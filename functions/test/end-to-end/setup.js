const fs = require('fs');
const AUTH_FILE_PATH = '../auth.json';

// Write firbase auth file from environment if non-existent
if (process.env.FIREBASE_FUNCTIONS_AUTH && !fs.existsSync(AUTH_FILE_PATH)) {
  fs.writeFileSync(AUTH_FILE_PATH, Buffer.from(process.env.FIREBASE_FUNCTIONS_AUTH, 'hex'));
}

const test = require('firebase-functions-test')({
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'test-sapphire-inspections-8a9e3.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3',
}, AUTH_FILE_PATH);
const sinon = require('sinon');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

// Stub admin.initializeApp & `database()` to avoid live data access
sinon.stub(admin, 'initializeApp').returns({ database: () => db });
Object.defineProperty(admin, 'database', { writable: true, value: () => db });

module.exports = {
  db,
  test,
  cloudFunctions: require('../../index')
}
