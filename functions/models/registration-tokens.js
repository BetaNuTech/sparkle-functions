const assert = require('assert');
const modelSetup = require('./utils/model-setup');

// const PREFIX = 'models: registration-tokens:';
const TOKEN_COLLECTION = 'registrationTokens';

module.exports = modelSetup({
  /**
   * Lookup Firestore user's tokens
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  firestoreFindRecord(fs, userId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return fs
      .collection(TOKEN_COLLECTION)
      .doc(userId)
      .get();
  },

  /**
   * Create a Firestore user's registration tokens
   * @param  {admin.firestore} fs
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, userId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(TOKEN_COLLECTION)
      .doc(userId)
      .create(data);
  },
});
