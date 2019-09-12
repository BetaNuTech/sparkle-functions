const assert = require('assert');
const usersModel = require('../../models/users');
const adminUtils = require('../../utils/firebase-admin');

const PREFIX = 'teams: remove-for-property:';

/**
 * Remove all teams for a property
 * @param  {firebaseAdmin.database} db
 * @param  {String} propertyId
 * @param  {@google-cloud/pubsub} pubsubClient - PubSub instance
 * @param  {String} userTeamsTopic
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function removeForProperty(
  db,
  propertyId,
  pubsubClient,
  userTeamsTopic
) {
  assert(Boolean(db), 'has firebase admin database reference');
  assert(propertyId && typeof propertyId === 'string', 'has property ID');
  assert(
    pubsubClient && typeof pubsubClient.topic === 'function',
    'has pubsub client'
  );
  assert(
    userTeamsTopic && typeof userTeamsTopic === 'string',
    'has user teams topic'
  );

  const updates = Object.create(null);
  const publisher = pubsubClient.topic(userTeamsTopic).publisher();

  try {
    let teamId = '';
    const allTeamIds = await adminUtils.fetchRecordIds(db, '/teams');

    // Find only team associated w/ property
    for (let i = 0; i < allTeamIds.length; i++) {
      const currentTeamId = allTeamIds[i];
      const teamPropertyIds = await adminUtils.fetchRecordIds(
        db,
        `/teams/${currentTeamId}/properties`
      );

      if (teamPropertyIds.includes(propertyId)) {
        teamId = currentTeamId;
        break;
      }
    }

    // Property had no team
    if (!teamId) {
      return updates;
    }

    // Remove property association from team
    await db.ref(`/teams/${teamId}/properties/${propertyId}`).remove();
    const usersInRemovedTeam = await usersModel.findByTeam(db, teamId);

    // Queue sync for all users without waiting
    usersInRemovedTeam.forEach(userID =>
      publisher.publish(Buffer.from(userID))
    );
  } catch (e) {
    throw new Error(`${PREFIX} | ${e}`); // wrap error
  }
};
