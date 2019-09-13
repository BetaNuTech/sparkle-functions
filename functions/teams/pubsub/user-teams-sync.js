const log = require('../../utils/logger');
const teamsModel = require('../../models/teams');

const PREFIX = 'teams: pubsub: user-team-sync:';

/**
 * Sync users with all property/teams as its the
 * source of truth
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncUserTeamHandler(topic = '', pubsub, db) {
  return pubsub
    .topic(topic)
    .onPublish(async function syncUserTeamHandler(message /* , context */) {
      const updates = {};
      let userId = null;
      let propertyAndTeam = {};

      try {
        userId = message.data
          ? Buffer.from(message.data, 'base64').toString()
          : '';

        if (!userId) {
          throw Error('received invalid message');
        }
      } catch (err) {
        const msgErr = `${PREFIX} ${topic}: message error | ${err}`;
        log.error(msgErr);
        throw Error(msgErr);
      }

      log.info(`${PREFIX} ${topic}: syncing user teams of "${userId}"`);

      // load all properties team associations (source of truth)
      try {
        propertyAndTeam = await teamsModel.getPropertyRelationships(db);
      } catch (err) {
        log.error(`${PREFIX} ${topic} | ${err}`);
        throw err;
      }

      const currentUserSnap = await db.ref(`/users/${userId}`).once('value');
      const currentUser = currentUserSnap.val();

      if (currentUser.teams) {
        const usersCurrentTeams = Object.keys(currentUser.teams);

        // Lookup user's team associations (source of truth of user/team membership)
        // and apply the global team/property associations (source of truth of team/property association)
        // reducing them into current user's single multi-nested teams hash
        const usersUpdatedTeams = usersCurrentTeams.reduce(
          (updatedTeams, teamId) => {
            updatedTeams[teamId] = propertyAndTeam[teamId]
              ? propertyAndTeam[teamId]
              : true;
            return updatedTeams;
          },
          {}
        );

        try {
          await db.ref(`/users/${userId}/teams`).set(usersUpdatedTeams);
          updates[`/users/${userId}/teams`] = 'synced';
        } catch (err) {
          // wrap error
          throw Error(
            `${PREFIX} ${topic}: error syncing user "${userId}" teams | ${err}`
          );
        }
      }

      return updates;
    });
};
