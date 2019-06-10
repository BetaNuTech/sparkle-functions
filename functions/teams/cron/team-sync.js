const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const teamsModel = require('../../models/teams');
const LOG_PREFIX = 'teams: cron: team-sync:';

/**
 * Sync teams with all property/teams as its the
 * source of truth
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncTeamHandler(topic = '', pubsub, db) {
  return pubsub
  .topic(topic)
  .onPublish(async function syncTeamHandler() {
    const updates = {};
    let propertyAndTeam = {};

    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    try {
      // load all properties team associations (source of truth)
      propertyAndTeam = await teamsModel.getPropertyRelationships(db);
    } catch (err) {
      log.error(`${LOG_PREFIX} ${err}`);
      throw err;
    }

    try {
      // loop through all teams and async up with the properties (source of truth)
      await adminUtils.forEachChild(db, '/teams', async function teamWrite(teamId) {
        const currentTeamsActualProperties = propertyAndTeam[teamId];
        if (currentTeamsActualProperties) {
          // Upsert team with properties
          await db.ref(`/teams/${teamId}/properties`).set(currentTeamsActualProperties);
          updates[`/teams/${teamId}/properties`] = currentTeamsActualProperties;
        } else {
          // Ensure teams properties does not exist
          await db.ref(`/teams/${teamId}/properties`).remove();
          updates[`/teams/${teamId}/properties`] = null;
        }
      });
    } catch (err) {
      log.error(`${LOG_PREFIX} for each team sync failed: ${err}`);
      throw err;
    }

    return updates;
  });
}
