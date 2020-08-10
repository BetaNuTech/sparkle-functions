const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: registration-tokens:';
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

  /**
   * Check all registration tokens
   * for all users and remove outdated
   * @param  {admin.firestore} fs
   * @param  {Number}  maxTimestamp
   * @param  {firestore.batch?}  parentBatch
   * @return {Promise} - {resolves} DocumentSnapshot
   */
  async firestoreRemoveOutdated(fs, maxTimestamp, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      typeof maxTimestamp === 'number' && maxTimestamp === maxTimestamp,
      'has max timestamp'
    );
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has valid firestore batch'
      );
    }

    const batch = parentBatch || fs.batch();

    // Lookup all registration tokens
    let tokensSnap = null;
    try {
      tokensSnap = await fs.collection(TOKEN_COLLECTION).get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreRemoveOutdated: Failed to lookup all tokens: ${err}`
      );
    }

    // Append batched update for all of
    // each user's outdated timestamps
    tokensSnap.forEach(userTokensSnap => {
      const userTokensData = userTokensSnap.data() || {};
      const tokenIds = Object.keys(userTokensData);
      const expiredTokenRemovals = tokenIds.reduce((acc, tokenId) => {
        const tokenCreationDate = userTokensData[tokenId];
        if (
          typeof tokenCreationDate === 'number' &&
          tokenCreationDate <= maxTimestamp
        ) {
          acc[tokenId] = FieldValue.delete();
        }
        return acc;
      }, {});

      // Append any updates to batch
      if (Object.keys(expiredTokenRemovals).length) {
        batch.update(userTokensSnap.ref, expiredTokenRemovals);
      }
    });

    // Commit batch when
    // not part of parent batch
    if (!parentBatch) {
      try {
        await batch.commit();
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreRemoveOutdated: Failed to commit batch: ${err}`
        );
      }
    }

    return Promise.resolve(tokensSnap);
  },
});
