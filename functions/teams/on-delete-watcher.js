const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');
const teamsModel = require('../models/teams');
const propertiesModel = require('../models/properties');

const PREFIX = 'teams: team-delete:';

/**
 * Factory team delete handlers
 * @param  {admin.database} db - Firebase Admin DB instance
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - team delete handler
 */
module.exports = function teamDeleteHandler(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (teamSnap, context) => {
    const { teamId } = context.params;

    if (!teamId) {
      throw Error(`${PREFIX} incorrectly defined event parameter "teamId"`);
    }

    log.info(`${PREFIX} team deleted: ${teamId}`);

    // Remove firestore team
    try {
      await teamsModel.firestoreRemoveRecord(fs, teamId);
    } catch (err) {
      log.error(`${PREFIX} error when trying to remove firestore team: ${err}`);
      throw err;
    }

    const allPropertiesAffectedSnap = await propertiesModel.getPropertiesByTeamId(
      db,
      teamId
    );

    const properties = allPropertiesAffectedSnap.exists()
      ? allPropertiesAffectedSnap.val()
      : null;

    if (properties) {
      const propertyIds = Object.keys(properties);

      // Cleanup realtime properties
      try {
        await propertiesModel.realtimeBatchRemoveTeam(db, propertyIds);
      } catch (err) {
        log.error(
          `${PREFIX} error when trying to remove properties' team | ${err}`
        );
      }

      // Cleanup firestore properties
      try {
        await propertiesModel.firestoreBatchRemoveTeam(fs, propertyIds);
      } catch (err) {
        log.error(
          `${PREFIX} error when trying to remove firestore properties' team | ${err}`
        );
      }
    }

    const usersInRemovedTeam = await usersModel.findByTeam(db, teamId);
    const userIds = usersInRemovedTeam.length > 0 ? usersInRemovedTeam : null;

    if (userIds) {
      // Cleanup realtime users
      try {
        usersModel.realtimeBatchRemoveTeam(db, userIds, teamId);
      } catch (err) {
        log.error(
          `${PREFIX} error when trying to remove users' teams | ${err}`
        );
        throw err;
      }

      // Cleanup firestore users
      try {
        usersModel.firestoreBatchRemoveTeam(fs, userIds, teamId);
      } catch (err) {
        log.error(
          `${PREFIX} error when trying to remove firestore users' teams | ${err}`
        );
        throw err;
      }
    }
  };
};
