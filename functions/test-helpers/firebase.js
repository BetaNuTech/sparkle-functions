const assert = require('assert');
const uuid = require('./uuid');

module.exports = {
  /**
   * Create a Firebase database stub resolving provided data snapshot
   * @param  {Object} config
   * @param  {Object} dataSnapshot
   * @param  {Object} childConf
   * @return {Object} - configuration for `Object.defineProperty()`
   */
  createDatabaseStub(config = {}, dataSnapshot = {}, childConf = {}) {
    const childWrapper = Object.assign(
      {
        child: () => childWrapper,
        orderByChild: () => childWrapper,
        orderByKey: () => childWrapper,
        limitToFirst: () => childWrapper,
        equalTo: () => childWrapper,
        once: () => Promise.resolve(dataSnapshot),
        remove: () => Promise.resolve(true),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
      },
      childConf
    );

    return Object.assign(
      {
        writable: true,
        value: () => ({
          _isTestStub: true,
          ref: () => childWrapper,
        }),
      },
      config
    );
  },

  /**
   * Create a Firestore stub for testing
   * @param  {Object} config
   * @param  {Object} dataSnapshot
   * @param  {Object} childConf
   * @return {Object} - stub
   */
  createFirestoreStub(config = {}, dataSnapshot = {}, childConf = {}) {
    const childWrapper = Object.assign(
      {
        collection: () => childWrapper,
        doc: () => childWrapper,
        batch: () => childWrapper,
        where: () => childWrapper,
        set: () => Promise.resolve(),
        get: () => Promise.resolve(dataSnapshot),
        add: () => Promise.resolve(),
        create: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(true),
      },
      childConf
    );

    return Object.assign(
      {
        _isTestStub: true,
      },
      childWrapper,
      config
    );
  },

  /**
   * Create stub for PubSub Subscriber
   * @return {Object} - Wrapper for `firebase.pubsub.topic.onPublish()`
   */
  createPubSubStub() {
    return {
      topic: () => ({
        onPublish: fn => fn(),
        publisher: () => ({ publish: () => Promise.resolve('done') }),
      }),
    };
  },

  /**
   * Create a Firebase messaging stub with a provided API
   * @param  {Object} config
   * @param  {Object} api
   * @return {Object} - configuration for `Object.defineProperty()`
   */
  createMessagingStub(config = {}, api = {}) {
    return Object.assign(
      {
        writable: true,
        value: () => api,
      },
      config
    );
  },

  /**
   * Create a mock firestore document reference
   * https://googleapis.dev/nodejs/firestore/latest/DocumentReference.html
   * @param  {Object} docConfig
   * @return {Object}
   */
  createDocRef(docConfig = {}) {
    const id = uuid();
    return {
      id,
      path: `collection/${id}`,
      parent: {},
      ...docConfig,
    };
  },

  /**
   * Create a Firebase DocumentSnapshot for testing
   * @param  {String} id
   * @param  {Object} data
   * @return {Object}
   */
  createDocSnapshot(id, data) {
    return {
      exists: Boolean(data),
      id,
      data: () => data,
    };
  },

  /**
   * Create a Firebase QuerySnapshot for testing
   * @param  {Object[]?} data
   * @return {Object}
   */
  createQuerySnapshot(data = []) {
    assert(Array.isArray(data), 'has array');
    assert(
      data.every(d => d && typeof d === 'object'),
      'has array of objects'
    );

    const snap = {
      size: data.length,
      empty: data.length === 0,
      docs: data.map(datum => this.createDocSnapshot(datum.id, datum)),
    };

    return snap;
  },

  /**
   * Remove all records from
   * Realtime and Firebase database
   * @param  {firebaseAdmin.database} db
   * @param  {firebaseAdmin.firestore?} fs
   * @return {Promise}
   */
  cleanDb(db, fs) {
    const realtimeDbReq = [];
    if (db) {
      realtimeDbReq.push(
        db.ref().update({
          '/archive': null,
          '/completedInspectionsList': null,
          '/inspections': null,
          '/properties': null,
          '/propertyInspectionDeficientItems': null,
          '/propertyInspectionsList': null,
          '/propertyTemplatesList': null,
          '/registrationTokens': null,
          '/teams': null,
          '/templateCategories': null,
          '/templates': null,
          '/templatesList': null,
          '/users': null,
          '/sendMessages': null,
          '/integrations': null,
          '/notifications': null,
        })
      );
    }

    const firestoreDbReq = [];

    // Optionally remove all Firestore collections
    if (fs) {
      firestoreDbReq.push(
        ...[
          'templates',
          'properties',
          'inspections',
          'deficiencies',
          'templateCategories',
          'archives',
          'users',
          'teams',
          'system',
          'integrations',
          'notifications',
          'registrationTokens',
          'jobs',
          'bids',
        ].map(col => deleteFirestoreCollection(fs, col))
      );
    }

    return Promise.all([...realtimeDbReq, ...firestoreDbReq]);
  },

  /**
   * Find an image in a test directory's images bucket
   * @param  {firebaseAdmin.storage} bucket
   * @param  {String} prefix
   * @param  {String} fileName
   * @return {Promise} - resolves {Object} file reference
   */
  findStorageFile(bucket, prefix, fileName) {
    assert('has storage bucket', bucket);
    assert(
      'has test directory prefix',
      prefix && `${prefix}`.search(/Test$/) !== -1
    );
    assert('has filename', fileName && typeof fileName === 'string');

    return bucket
      .getFiles({ prefix })
      .then(([files]) => files.filter(f => f.name.search(fileName) > -1)[0]);
  },

  /**
   * Stubbed auth of methods used by
   * utils/auth-firebase-user module
   * @param  {String} userId
   * @return {Object} - stubbed firebaseAdmin.auth
   */
  stubFirbaseAuth(userId) {
    assert(userId && typeof userId === 'string', 'has user id');

    return {
      verifyIdToken: () => Promise.resolve({ uid: userId }),
    };
  },
};

/**
 * Remove all documents from a Firestore
 * collectoin
 * @param  {firebaseAdmin.firestore} fs
 * @param  {String} collection
 * @return {Promise}
 */
async function deleteFirestoreCollection(fs, collection) {
  const snapshot = await fs.collection(collection).get();
  if (snapshot.size === 0) return;

  // Delete documents in a batch
  const batch = fs.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  return batch.commit();
}
