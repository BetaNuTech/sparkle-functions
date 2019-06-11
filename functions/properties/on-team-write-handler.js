const log = require('../utils/logger');
const usersModel = require('../models/users');

const LOG_PREFIX = 'properties - team: on-write:';
/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {@google-cloud/pubsub} pubsubClient - PubSub instance
 * @param  {String} userTeamsTopic
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnTeamsWriteHandler(
  db,
  pubsubClient,
  userTeamsTopic
) {
  return async (change, event) => {
    const updates = {};
    const { propertyId } = event.params;

    if (!propertyId) {
      log.warn(
        `${LOG_PREFIX} incorrectly defined event parameter "propertyId"`
      );
      return;
    }

    const beforeTeam = change.before.exists() ? change.before.val().team : null;
    const afterTeam = change.after.exists() ? change.after.val().team : null;
    const publisher = pubsubClient.topic(userTeamsTopic).publisher();

    // Team removed
    if (!afterTeam) {
      return updates;
    }

    log.info(
      `${LOG_PREFIX} property ${propertyId} - team ${afterTeam} updated`
    );

    // Remove old team / property association
    if (beforeTeam !== afterTeam) {
      try {
        await db.ref(`/teams/${beforeTeam}/properties/${propertyId}`).set(null);
        updates[`/teams/${beforeTeam}/properties/${propertyId}`] = 'removed';
        const usersInBeforeTeam = await usersModel.findByTeam(db, beforeTeam);

        await Promise.all(
          usersInBeforeTeam.map(userID => {
            updates[userTeamsTopic] = userID;
            return publisher.publish(Buffer.from(userID));
          })
        );
      } catch (e) {
        log.error(
          `${LOG_PREFIX} property: ${propertyId} remove from team: ${beforeTeam} - failed: ${e}`
        );
      }
    }

    try {
      const userUpdates = {};
      const usersInAfterTeam = await usersModel.findByTeam(db, afterTeam);

      usersInAfterTeam.forEach(userID => {
        userUpdates[`/users/${userID}/teams/${afterTeam}/${propertyId}`] = true;
        updates[`/users/${userID}/teams/${afterTeam}/${propertyId}`] =
          'upserted';
        updates[userTeamsTopic] = userID;

        // Queue update of users' teams
        publisher.publish(Buffer.from(userID));
      });

      await db.ref().update(userUpdates);
      await db.ref(`/teams/${afterTeam}/properties/${propertyId}`).set(true);
      updates[`/teams/${afterTeam}/properties/${propertyId}`] = 'upserted';
    } catch (e) {
      log.error(
        `${LOG_PREFIX} property: ${propertyId} upsert to team: ${afterTeam} - failed: ${e}`
      );
      return;
    }

    return updates;
  };
};
