const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: teams:';
const TEAMS_COLLECTION = 'teams';

module.exports = modelSetup({
  /**
   * Lookup Firestore Team
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} teamId
   * @param  {firestore.transaction?} transaction
   * @return {Promise}
   */
  findRecord(fs, teamId, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    const query = fs.collection(TEAMS_COLLECTION).doc(teamId);

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
   * Create a firestore document id
   * @param  {admin.firestore} db
   * @return {String}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(TEAMS_COLLECTION).doc().id;
  },

  /**
   * Create a Firestore team
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(fs, teamId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(TEAMS_COLLECTION)
      .doc(teamId)
      .create(data);
  },

  /**
   * Create or update a Firestore team
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  teamId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(fs, teamId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(TEAMS_COLLECTION).doc(teamId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;
    const upsert = { ...data };

    try {
      if (exists) {
        // Replace optional field nulls
        // with Firestore delete values
        if (upsert.properties === null) {
          upsert.properties = FieldValue.delete();
        }

        await docRef.update(upsert);
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.properties) delete upsert.properties;
        await docRef.create(upsert);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} upsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Remove Firestore Team
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} teamId
   * @return {Promise}
   */
  removeRecord(fs, teamId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    return fs
      .collection(TEAMS_COLLECTION)
      .doc(teamId)
      .delete();
  },

  /**
   * Query all teams
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let dbQuery = db.collection(TEAMS_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      dbQuery = dbQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return Promise.resolve(transaction.get(dbQuery));
    }

    return dbQuery.get(query);
  },
});
