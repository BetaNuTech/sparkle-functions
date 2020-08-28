const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

try {
  const cwd = process.cwd();

  // Consume any `.env` in cwd and/or 2 parent directories
  dotenv.config({ path: path.resolve(cwd, '.env.test') });
  dotenv.config({ path: path.resolve(`${cwd}/..`, '.env.test') });
  dotenv.config({ path: path.resolve(`${cwd}/../..`, '.env.test') });
} catch (err) {} // eslint-disable-line no-empty

// Force `NODE_ENV` to "test"
// to ensure no production db is used
process.env.NODE_ENV = 'test';

const sinon = require('sinon');
const PubSub = require('@google-cloud/pubsub');
const CONFIG = require('../config');

const { firebase: testConfig } = CONFIG;
const test = require('firebase-functions-test')(testConfig); // eslint-disable-line
const s3Client = require('../utils/s3-client');

// Firebase Project ID must contain
// "test" to be used by the E2E test suite
if (`${testConfig.projectId}`.search('test') === -1) {
  throw Error('Must only provide test project credentials to E2E test suite');
}

admin.initializeApp(testConfig);
const db = admin.database();
const fs = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

// Stub admin.initializeApp & `database()` to avoid live data access
sinon.stub(admin, 'initializeApp').returns({ database: () => db });
Object.defineProperty(admin, 'database', { writable: true, value: () => db });
Object.defineProperty(admin, 'storage', {
  writable: true,
  value: () => storage,
});
Object.defineProperty(admin, 'messaging', {
  writable: true,
  value: () => messaging,
});

// Stub out pubsub publisher prototype
// to avoid publishing live messages
const pubsubSubscribers = {};
Object.defineProperty(PubSub.prototype, 'topic', {
  writable: true,
  value: topic => ({
    publisher: () => ({
      publish(data) {
        if (
          pubsubSubscribers[topic] &&
          Array.isArray(pubsubSubscribers[topic])
        ) {
          pubsubSubscribers[topic].forEach(subscriber => subscriber(data));
        }
        return Promise.resolve();
      },
    }),
  }),
});

module.exports = {
  db,
  fs,
  auth,
  test,
  storage,
  messaging,
  uid: testConfig.databaseAuthVariableOverride.uid,
  cloudFunctions: require('../index'), // eslint-disable-line

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

  pubsub: {
    subscribe(topic, fn) {
      pubsubSubscribers[topic] = pubsubSubscribers[topic] || [];
      pubsubSubscribers[topic].push(fn);

      return function unsubscribe() {
        return pubsubSubscribers[topic].splice(
          pubsubSubscribers[topic].indexOf(fn),
          1
        );
      };
    },
  },
};
