const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

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
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    const propertyAndTeam = {};

    // load all properties team associations (source of truth)
    await adminUtils.forEachChild(db, '/properties', function buildSourceOfTruth(propertyId, property) {
      if (property.team) {
        propertyAndTeam[property.team] = propertyAndTeam[property.team] || {};
        propertyAndTeam[property.team][propertyId] = true;
      }
    });

    // loop through all teams and async up with the properties (source of truth)
    await adminUtils.forEachChild(db, '/teams', async function teamWrite(teamId) {
      const currentTeamsActualProperties = propertyAndTeam[teamId];
      await db.ref(`/teams/${teamId}/properties`).set(currentTeamsActualProperties);
      updates[`/teams/${teamId}/properties`] = currentTeamsActualProperties;
    });

    return updates;
  });
}
