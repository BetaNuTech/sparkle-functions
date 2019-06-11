const log = require('../../utils/logger');
const LOG_PREFIX = 'user-teams: user-teams-sync:';

/**
 * Factory for /users/{userId}/teams/{teamId} on write handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @param  {@google-cloud/pubsub} pubsubClient - PubSub instance
 * @param  {String} userTeamsTopic
 * @return {Function} - /users/{userId}/teams/{teamId} onWrite handler
 */
module.exports = function createOnUserTeamWriteHandler(
  db,
  storage,
  pubsubClient,
  userTeamsTopic
) {
  return async (propertySnap, event) => {
    const { userId } = event.params;

    log.info(`${LOG_PREFIX} user sync triggered for ${userId}`);

    // publishing the sync request after 10 seconds
    setTimeout(() => {
      const publisher = pubsubClient.topic(userTeamsTopic).publisher();
      return publisher.publish(Buffer.from(userId));
    }, 10000);
  };
};
