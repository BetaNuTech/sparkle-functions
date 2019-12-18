const log = require('../utils/logger');
const usersModel = require('../models/users');
const teamsModel = require('../models/teams');

const PREFIX = 'teams: team-delete:';

/**
 * Factory for /teams/{teamId} on delete handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - /teams/{teamId} onDelete handler
 */
module.exports = function teamDeleteHandler(db) {
  return async (teamSnap, context) => {
    const updates = {};
    const { teamId } = context.params;

    if (!teamId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "teamId"`);
      return;
    }

    log.info(`${PREFIX} team deleted: ${teamId}`);

    const allPropertiesAffectedSnap = await teamsModel.getPropertiesByTeamId(
      db,
      teamId
    );

    const properties = allPropertiesAffectedSnap.exists()
      ? allPropertiesAffectedSnap.val()
      : null;

    if (properties) {
      const propertyIds = Object.keys(properties);

      try {
        await Promise.all(
          propertyIds.map(propertyId => {
            updates[`/properties/${propertyId}/team`] = 'removed';
            return db.ref(`/properties/${propertyId}/team`).remove();
          })
        );
      } catch (err) {
        log.error(
          `${PREFIX} error when trying to remove properties' team ${err}`
        );
      }
    }

    const usersInRemovedTeam = await usersModel.findByTeam(db, teamId);
    const userIds = usersInRemovedTeam.length > 0 ? usersInRemovedTeam : null;

    if (userIds) {
      try {
        await Promise.all(
          userIds.map(userId => {
            updates[`/users/${userId}/teams/${teamId}`] = 'removed';
            return db.ref(`/users/${userId}/teams/${teamId}`).remove();
          })
        );
      } catch (err) {
        log.error(`${PREFIX} error when trying to remove users' teams ${err}`);
        throw err;
      }
    }

    return updates;
  };
};
