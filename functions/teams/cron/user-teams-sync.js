const log = require('../../utils/logger');
const teamsModel = require('../../models/teams');
const LOG_PREFIX = 'teams: cron: user-team-sync:';

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
    .onPublish(async function syncUserTeamHandler(message, context) {
      const updates = {};
      let userId = null;
      let propertyAndTeam = {};

      log.info(`${LOG_PREFIX} received ${Date.now()}`);

      try {
        userId = message.json.id;
      } catch (e) {
        log.error(
          `${LOG_PREFIX} PubSub message was not JSON: ${e} | message ${message.json}`
        );
        throw Error(
          `${LOG_PREFIX} PubSub message was not JSON: ${e} | message ${message.json}`
        );
      }

      // load all properties team associations (source of truth)
      try {
        propertyAndTeam = await teamsModel.getPropertyRelationships(db);
      } catch (err) {
        log.error(`${LOG_PREFIX} ${err}`);
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
              : null;
            return updatedTeams;
          },
          {}
        );

        try {
          await db.ref(`/users/${userId}/teams`).set(usersUpdatedTeams);
          updates[`/users/${userId}/teams`] = 'synced';
        } catch (err) {
          const syncErr = Error(
            `${LOG_PREFIX} error syncing user ${userId} teams: ${err}`
          );
          log.error(`${syncErr}`);
          throw syncErr;
        }
      }

      return updates;
    });
};
