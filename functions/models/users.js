const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: users:';
const USERS_COLLECTION = 'users';

module.exports = modelSetup({
  /**
   * Batch remove all firestore users
   * relationships to a deleted team
   * @param  {admin.database} db
   * @param  {String[]} userIds
   * @param  {String} teamId
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  firestoreBatchRemoveTeam(fs, userIds, teamId, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userIds && Array.isArray(userIds), 'has user ids is an array');
    assert(
      userIds.every(id => id && typeof id === 'string'),
      'user ids is an array of strings'
    );
    assert(teamId && typeof teamId === 'string', 'has team id');
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has firestore batch/transaction'
      );
    }

    const batch = parentBatch || fs.batch();
    const collection = fs.collection(USERS_COLLECTION);

    // Remove each users team
    userIds.forEach(id => {
      const userDoc = collection.doc(id);
      batch.update(userDoc, { [`teams.${teamId}`]: FieldValue.delete() });
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Lookup Firestore user
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  firestoreFindRecord(fs, userId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return fs
      .collection(USERS_COLLECTION)
      .doc(userId)
      .get();
  },

  /**
   * Create or update a Firestore user
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, userId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(USERS_COLLECTION).doc(userId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
    }

    const { exists } = docSnap;
    const upsert = { ...data };

    try {
      if (exists) {
        // Replace optional field nulls
        // with Firestore delete values
        if (upsert.teams === null) {
          upsert.teams = FieldValue.delete();
        }
        if (upsert.properties === null) {
          upsert.properties = FieldValue.delete();
        }

        await docRef.update(upsert);
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.teams) delete upsert.teams;
        if (!upsert.properties) delete upsert.properties;
        await docRef.create(upsert);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Create a Firestore user
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
      .collection(USERS_COLLECTION)
      .doc(userId)
      .create(data);
  },

  /**
   * Remove Firestore User
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, userId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return fs
      .collection(USERS_COLLECTION)
      .doc(userId)
      .delete();
  },
  /**
   * Query all users with a team in
   * their `teams` hash
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {QuerySnapshot}
   */
  firestoreFindByTeam(fs, teamId, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    const query = fs
      .collection(USERS_COLLECTION)
      .orderBy(`teams.${teamId}`)
      .startAfter(null);

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return transaction.get(query);
    }

    return query.get();
  },

  /**
   * Query all uers
   * @param  {admin.firestore} fs
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQuery(fs, query, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
    }

    let fsQuery = fs.collection(USERS_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      fsQuery = fsQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      return Promise.resolve(transaction.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Lookup all user documents snapshots
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreFindAll(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(USERS_COLLECTION).get();
  },
});
