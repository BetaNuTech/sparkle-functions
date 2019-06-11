const assert = require('assert');
const modelSetup = require('./utils/model-setup');

module.exports = modelSetup({
  /**
   * This is a helper function used to get all users in a team
   * @param  {firebaseAdmin.database} db
   * @param  {String} teamId id of the team of which you would like to retrieve the users
   * @return {Object[]} - resolves an array containing all user IDs that belong to this team
   */
  async findByTeam(db, teamId) {
    assert(teamId && typeof teamId === 'string', 'has team id');

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
});
