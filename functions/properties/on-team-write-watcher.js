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

    const userUpdateQueue = [];
    const beforeTeam = change.before.val();
    const afterTeam = change.after.val();
    const publisher = pubsubClient.topic(userTeamsTopic).publisher();
    const isTeamRemoved = !afterTeam;

    log.info(
      `${LOG_PREFIX} property ${propertyId} - team ${
        isTeamRemoved ? beforeTeam : afterTeam
      } ${isTeamRemoved ? 'removed' : 'updated'}`
    );

    // Remove old team / property association
    if (beforeTeam && beforeTeam !== afterTeam) {
      try {
        // Remove old property from team record
        await db.ref(`/teams/${beforeTeam}/properties/${propertyId}`).set(null);
        updates[`/teams/${beforeTeam}/properties/${propertyId}`] = 'removed';

        // Queue update of removed team's users
        const usersInBeforeTeam = await usersModel.findByTeam(db, beforeTeam);
        usersInBeforeTeam.forEach(userID => {
          updates[userTeamsTopic] = userID;
          userUpdateQueue.push(userID);
        });
      } catch (e) {
        log.error(
          `${LOG_PREFIX} property: ${propertyId} remove from team: ${beforeTeam} - failed: ${e}`
        );
      }
    }

    if (afterTeam) {
      try {
        // Add new property to team record
        await db.ref(`/teams/${afterTeam}/properties/${propertyId}`).set(true);
        updates[`/teams/${afterTeam}/properties/${propertyId}`] = 'upserted';

        // Queue update of new team's users
        const usersInAfterTeam = await usersModel.findByTeam(db, afterTeam);
        usersInAfterTeam.forEach(userID => {
          updates[userTeamsTopic] = userID;
          userUpdateQueue.push(userID);
        });
      } catch (e) {
        log.error(
          `${LOG_PREFIX} property: ${propertyId} upsert to team: ${afterTeam} - failed: ${e}`
        );
      }
    }

    // Queue update to all users
    // with changed teams
    userUpdateQueue
      .filter((userID, i, all) => all.indexOf(userID) === i) // unique only
      .forEach(userID => publisher.publish(Buffer.from(userID)));

    return updates; // eslint-disable-line
  };
};
