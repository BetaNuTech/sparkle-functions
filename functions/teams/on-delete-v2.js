const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');
const propertiesModel = require('../models/properties');

const PREFIX = 'teams: team-delete:';

/**
 * Factory team delete handlers
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - team delete handler
 */
module.exports = function teamDeleteV2(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (teamSnap, context) => {
    const { teamId } = context.params;

    if (!teamId) {
      throw Error(`${PREFIX} incorrectly defined event parameter "teamId"`);
    }

    try {
      await fs.runTransaction(async transaction => {
        // Lookup team's properties
        const propertiesOfTeamIds = [];
        try {
          const propertiesOfTeamSnap = await propertiesModel.firestoreQuery(
            fs,
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
          const usersInRemovedTeamSnap = await usersModel.firestoreFindByTeam(
            fs,
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
            await propertiesModel.firestoreBatchRemoveTeam(
              fs,
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
            usersModel.firestoreBatchRemoveTeam(
              fs,
              usersOfTeamIds,
              teamId,
              transaction
            );
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
