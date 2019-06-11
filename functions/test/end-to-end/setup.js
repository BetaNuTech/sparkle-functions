const fs = require('fs');
const s3Client = require('../../utils/s3-client');
const CONFIG = require('../../config');
const AUTH_FILE_PATH = '../auth.json';

// Write firbase auth file from environment if non-existent
if (process.env.FIREBASE_FUNCTIONS_AUTH && !fs.existsSync(AUTH_FILE_PATH)) {
  fs.writeFileSync(
    AUTH_FILE_PATH,
    Buffer.from(process.env.FIREBASE_FUNCTIONS_AUTH, 'hex')
  );
}

const testConfig = {
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'sapphire-inspections.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3',
};
const test = require('firebase-functions-test')(testConfig, AUTH_FILE_PATH);
const sinon = require('sinon');
const admin = require('firebase-admin');
const PubSub = require('@google-cloud/pubsub');

admin.initializeApp(testConfig);
const db = admin.database();
const auth = admin.auth();
const storage = admin.storage();

// Stub admin.initializeApp & `database()` to avoid live data access
sinon.stub(admin, 'initializeApp').returns({ database: () => db });
Object.defineProperty(admin, 'database', { writable: true, value: () => db });
Object.defineProperty(admin, 'storage', {
  writable: true,
  value: () => storage,
});

// Stub out pubsub publisher prototype
// to avoid publishing live messages
Object.defineProperty(PubSub.prototype, 'topic', {
  writable: true,
  value: () => ({
    publisher: () => ({
      publish: () => Promise.resolve(),
    }),
  }),
});

module.exports = {
  db,
  auth,
  test,
  storage,
  cloudFunctions: require('../../index'),

  /**
   * Delete an inspection PDF from S3 Bucket
   * @param  {String} destPath
   * @return {Promise} - resolves {Object} success response
   */
  deletePDFInspection(destPath) {
    const [, finalPath] = destPath.split(
      `${CONFIG.s3.inspectionReportBucket}.s3.amazonaws.com/`
    );

    return new Promise((resolve, reject) => {
      s3Client.deleteObject(
        {
          Bucket: CONFIG.s3.inspectionReportBucket,
          Key: finalPath,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });
  },
};
