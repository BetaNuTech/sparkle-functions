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
  firestoreFindRecord(fs, teamId, transaction) {
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
   * Create a Firestore team
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, teamId, data) {
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
  async firestoreUpsertRecord(fs, teamId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(TEAMS_COLLECTION).doc(teamId);
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
        `${PREFIX} firestoreUpsertRecord: ${
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
  firestoreRemoveRecord(fs, teamId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    return fs
      .collection(TEAMS_COLLECTION)
      .doc(teamId)
      .delete();
  },
});
