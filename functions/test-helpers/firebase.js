const assert = require('assert');

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
   * Create stub for PubSub Subscriber
   * @return {Object} - Wrapper for `firebase.pubsub.topic.onPublish()`
   */
  createPubSubStub() {
    return {
      topic: () => ({
        onPublish: fn => fn(),
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

  cleanDb(db) {
    return db.ref('/').set(null);
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
};
