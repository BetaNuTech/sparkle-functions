const assert = require('assert');
const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const teamsModel = require('../../models/teams');

const PREFIX = 'teams: pubsub: team-sync:';

/**
 * Sync teams with all property/teams
 * as its the source of truth
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {admin.database} db
 * @param  {admin.firestore} fs
 * @return {Function}
 */
module.exports = function createSyncTeamHandler(topic = '', pubsub, db, fs) {
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(Boolean(pubsub), 'has pubsub client');
  assert(db && typeof db.ref === 'function', 'has realime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return pubsub.topic(topic).onPublish(async () => {
    let propertyAndTeam = {};

    try {
      // load all properties team associations (source of truth)
      propertyAndTeam = await teamsModel.getPropertyRelationships(db);
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      throw err;
    }

    try {
      // loop through all teams and async up with the properties (source of truth)
      await adminUtils.forEachChild(db, '/teams', async function teamWrite(
        teamId
      ) {
        const currentTeamsActualProperties = propertyAndTeam[teamId];
        if (currentTeamsActualProperties) {
          // Upsert team with properties
          await teamsModel.realtimeUpsertRecord(db, teamId, {
            properties: currentTeamsActualProperties,
          });
        } else {
          // Ensure teams properties does not exist
          await teamsModel.realtimeUpsertRecord(db, teamId, {
            properties: null,
          });
        }
      });
    } catch (err) {
      log.error(`${PREFIX} for each team sync failed | ${err}`);
      throw err;
    }
  });
};
