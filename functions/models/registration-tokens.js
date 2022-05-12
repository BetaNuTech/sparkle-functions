const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: registration-tokens:';
const TOKEN_COLLECTION = 'registrationTokens';

module.exports = modelSetup({
  /**
   * Lookup Firestore user's tokens
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  findRecord(db, userId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return db
      .collection(TOKEN_COLLECTION)
      .doc(userId)
      .get();
  },

  /**
   * Create a Firestore user's registration tokens
   * @param  {admin.firestore} db
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, userId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(TOKEN_COLLECTION)
      .doc(userId)
      .create(data);
  },

  /**
   * Check all registration tokens
   * for all users and remove outdated
   * @param  {admin.firestore} db
   * @param  {Number}  maxTimestamp
   * @param  {firestore.batch?}  parentBatch
   * @return {Promise} - {resolves} DocumentSnapshot
   */
  async removeOutdated(db, maxTimestamp, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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

    const batch = parentBatch || db.batch();

    // Lookup all registration tokens
    let tokensSnap = null;
    try {
      tokensSnap = await db.collection(TOKEN_COLLECTION).get();
    } catch (err) {
      throw Error(
        `${PREFIX} removeOutdated: Failed to lookup all tokens: ${err}`
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
        throw Error(`${PREFIX} removeOutdated: Failed to commit batch: ${err}`);
      }
    }

    return Promise.resolve(tokensSnap);
  },
});
