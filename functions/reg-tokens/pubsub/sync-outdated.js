const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

const PREFIX = 'reg-tokens: pubsub: sync-outdated:';
const OUTDATED_OFFSET = 2629800; // seconds in 1 month

/**
 * Sync registration tokens with booleans
 * to timestamps and remove old unused tokens
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncOudated(topic = '', pubSub, db) {
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};

    // Collect boolean tokens to updates hash
    await adminUtils.forEachChild(
      db,
      '/registrationTokens',
      async function tokenTimestampWrite(userId, tokens) {
        const now = Math.round(Date.now() / 1000);
        const maxDate = now - OUTDATED_OFFSET;
        const tokenIds = Object.keys(tokens);
        const booleanTokenIds = tokenIds.filter(
          tokenId => typeof tokens[tokenId] === 'boolean'
        );
        const expiredTokenIds = tokenIds.filter(tokenId => {
          const tokenCreationDate = tokens[tokenId];
          return (
            typeof tokenCreationDate === 'number' &&
            tokenCreationDate <= maxDate
          );
        });

        // Replace boolean token with UNIX
        // timestamp and append to updates hash
        booleanTokenIds.forEach(tokenId => {
          updates[`/registrationTokens/${userId}/${tokenId}`] = now;
        });

        // Append expired token removal to updates
        expiredTokenIds.forEach(tokenId => {
          updates[`/registrationTokens/${userId}/${tokenId}`] = null;
        });
      }
    );

    // Atomically write updates
    try {
      await db.ref().update(updates);
    } catch (err) {
      log.error(`${PREFIX} ${topic} update write failed | ${err}`);
    }

    return updates;
  });
};
