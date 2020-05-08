const assert = require('assert');
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const teamsModel = require('../../models/teams');

const PREFIX = 'teams: pubsub: user-team-sync:';

/**
 * Sync users with all property/teams as its the
 * source of truth
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {admin.database} db
 * @param  {admin.firestore} fs
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncUserTeamHandler(
  topic = '',
  pubsub,
  db,
  fs
) {
  assert(db && typeof db.ref === 'function', 'has realime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return pubsub
    .topic(topic)
    .onPublish(async function syncUserTeamHandler(message /* , context */) {
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

      const currentUserSnap = await usersModel.getUser(db, userId);
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

        // Replace realtime users teams with current
        try {
          await usersModel.realtimeUpsertRecord(db, userId, {
            teams: usersUpdatedTeams,
          });
        } catch (err) {
          log.error(`${PREFIX} error syncing user "${userId}" teams | ${err}`);
          throw err;
        }

        // Upsert firestore users with latest data
        try {
          await usersModel.firestoreUpsertRecord(fs, userId, {
            ...currentUser,
            teams: usersUpdatedTeams,
          });
        } catch (err) {
          log.error(`${PREFIX} error syncing user "${userId}" teams | ${err}`);
          throw err;
        }
      }
    });
};
