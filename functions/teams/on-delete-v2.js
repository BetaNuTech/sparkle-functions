const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');
const propertiesModel = require('../models/properties');

const PREFIX = 'teams: team-delete:';

/**
 * Factory team delete handlers
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - team delete handler
 */
module.exports = function teamDeleteV2(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async (teamSnap, context) => {
    const { teamId } = context.params;

    if (!teamId) {
      throw Error(`${PREFIX} incorrectly defined event parameter "teamId"`);
    }

    try {
      await db.runTransaction(async transaction => {
        // Lookup team's properties
        const propertiesOfTeamIds = [];
        try {
          const propertiesOfTeamSnap = await propertiesModel.query(
            db,
            {
              team: ['==', teamId],
            },
            transaction
          );
          propertiesOfTeamIds.push(
            ...propertiesOfTeamSnap.docs.map(({ id }) => id)
          );
        } catch (err) {
          log.error(
            `${PREFIX} failed to lookup properties associated with team | ${err}`
          );
        }

        // Lookup team's users
        const usersOfTeamIds = [];
        try {
          const usersInRemovedTeamSnap = await usersModel.findByTeam(
            db,
            teamId,
            transaction
          );
          usersOfTeamIds.push(
            ...usersInRemovedTeamSnap.docs.map(({ id }) => id)
          );
        } catch (err) {
          log.error(
            `${PREFIX} failed to lookup users associated with team | ${err}`
          );
        }

        // Cleanup team's properties
        if (propertiesOfTeamIds.length) {
          try {
            await propertiesModel.batchRemoveTeam(
              db,
              propertiesOfTeamIds,
              transaction
            );
          } catch (err) {
            log.error(`${PREFIX} error removing team from properties | ${err}`);
          }
        }

        // Cleanup team's users
        if (usersOfTeamIds.length) {
          try {
            usersModel.batchRemoveTeam(db, usersOfTeamIds, teamId, transaction);
          } catch (err) {
            log.error(`${PREFIX} error removing team from users | ${err}`);
          }
        }
      });
    } catch (err) {
      throw Error(`${PREFIX} team delete transaction failed | ${err}`);
    }
  };
};
