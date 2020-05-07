const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: user:';
const USER_COLLECTION = 'users';

module.exports = modelSetup({
  /**
   * This is a helper function used to get all users in a team
   * @param  {firebaseAdmin.database} db
   * @param  {String} teamId id of the team of which you would like to retrieve the users
   * @return {Object[]} - resolves an array containing all user IDs that belong to this team
   */
  async findByTeam(db, teamId) {
    assert(teamId && typeof teamId === 'string', `${PREFIX} has team id`);

    const allUsers = await db.ref('/users').once('value');
    const allUserVals = allUsers.val() || {};
    const userIds = Object.keys(allUserVals);

    // filtering out users that are not in the defined team
    return userIds.filter(
      user =>
        allUserVals[user] &&
        allUserVals[user].teams &&
        allUserVals[user].teams[teamId]
    );
  },

  /**
   * Lookup single user
   * @param  {firebaseAdmin.database} db
   * @param  {String} userId
   * @return {Promise} - resolves {DataSnapshot}
   */
  getUser(db, userId) {
    assert(userId && typeof userId === 'string', `${PREFIX} has user id`);
    return db.ref(`/users/${userId}`).once('value');
  },

  /**
   * Resolve all users
   * @param  {firebaseAdmin.database} db
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAll(db) {
    return db.ref('/users').once('value');
  },

  /**
   * Create or update a Firestore user
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  userId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, userId, data) {
    assert(userId && typeof userId === 'string', `${PREFIX} has user id`);
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);

    const docRef = fs.collection(USER_COLLECTION).doc(userId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
    }

    const { exists } = docSnap;
    const current = docSnap.data() || {};
    const upsert = { ...data };

    try {
      if (exists) {
        // Replace optional field nulls
        // with Firestore delete values
        if (current.teams && data.teams === null) {
          upsert.teams = FieldValue.delete();
        }
        if (current.properties && data.properties === null) {
          upsert.properties = FieldValue.delete();
        }

        await docRef.update(upsert, { merge: true });
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
});
