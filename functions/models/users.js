const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: user:';
const USERS_DB = '/users';

module.exports = modelSetup({
  /**
   * This is a helper function used to get all users in a team
   * @param  {firebaseAdmin.database} db
   * @param  {String} teamId id of the team of which you would like to retrieve the users
   * @return {Object[]} - resolves an array containing all user IDs that belong to this team
   */
  async findByTeam(db, teamId) {
    assert(teamId && typeof teamId === 'string', `${PREFIX} has team id`);

    const allUsers = await db.ref(USERS_DB).once('value');
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
    return db.ref(`${USERS_DB}/${userId}`).once('value');
  },

  /**
   * Resolve all users
   * @param  {firebaseAdmin.database} db
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAll(db) {
    return db.ref(USERS_DB).once('value');
  },

  /**
   * Add/update realtime user
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, userId, data) {
    assert(userId && typeof userId === 'string', `${PREFIX} has user id`);
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${USERS_DB}/${userId}`).update(data);
  },
});
