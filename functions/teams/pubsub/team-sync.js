const adminUtils = require('../../utils/firebase-admin');
const teamsModel = require('../../models/teams');

const PREFIX = 'teams: pubsub: team-sync:';

/**
 * Sync teams with all property/teams as its the
 * source of truth
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncTeamHandler(topic = '', pubsub, db) {
  return pubsub.topic(topic).onPublish(async function syncTeamHandler() {
    const updates = {};
    let propertyAndTeam = {};

    try {
      // load all properties team associations (source of truth)
      propertyAndTeam = await teamsModel.getPropertyRelationships(db);
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} ${topic} | ${err}`);
    }

    try {
      // loop through all teams and async up with the properties (source of truth)
      await adminUtils.forEachChild(db, '/teams', async function teamWrite(
        teamId
      ) {
        const currentTeamsActualProperties = propertyAndTeam[teamId];
        if (currentTeamsActualProperties) {
          // Upsert team with properties
          await db
            .ref(`/teams/${teamId}/properties`)
            .set(currentTeamsActualProperties);
          updates[`/teams/${teamId}/properties`] = currentTeamsActualProperties;
        } else {
          // Ensure teams properties does not exist
          await db.ref(`/teams/${teamId}/properties`).remove();
          updates[`/teams/${teamId}/properties`] = null;
        }
      });
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} ${topic}: for each team sync failed | ${err}`);
    }

    return updates;
  });
};
