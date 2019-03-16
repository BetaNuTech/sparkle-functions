const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

const LOG_PREFIX = 'reg-tokens: cron: sync-outdated:';
const OUTDATED_OFFSET = 15778800; // seconds in 6 months

/**
 * Sync registration tokens with booleans
 * to timestamps and remove old unused tokens
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
*/
module.exports = function createSyncOudatedHandler(topic = '', pubSub, db) {
  return pubSub
  .topic(topic)
  .onPublish(async () => {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    // Collect boolean tokens to updates hash
    await adminUtils.forEachChild(db, '/registrationTokens', async function tokenTimestampWrite(userId, tokens) {
      const now = Date.now() / 1000;
      const booleanTokenIds = Object.keys(tokens).filter(tokenId => typeof tokens[tokenId] === 'boolean');

      // Set boolean token to updates
      booleanTokenIds.forEach(tokenId => updates[`/registrationTokens/${userId}/${tokenId}`] = now);
    });

    try {
      // Update boolean device tokens to timestamps
      Object.keys(updates).forEach(updatePath =>
        log.info(`${LOG_PREFIX} set timestamp at: ${updatePath}`));
      await db.ref().update(updates);
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
    }

    // Remove old & unused device tokens
    await adminUtils.forEachChild(db, '/registrationTokens', async function outdatedTokenWrite(userId, tokens) {
      const maxDate = (Date.now() / 1000) - OUTDATED_OFFSET;
      const tokenIds = Object.keys(tokens);

      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        const tokenCreationDate = tokens[tokenId];

        if (typeof tokenCreationDate === 'number' && tokenCreationDate <= maxDate) {
          const updatePath = `/registrationTokens/${userId}/${tokenId}`;
          try {
            await db.ref(updatePath).remove();
            updates[updatePath] = 'removed';
            log.info(`${LOG_PREFIX} removed outdated registration token at: ${updatePath}`);
          } catch (e) {
            log.error(`${LOG_PREFIX} ${e}`);
          }
        }
      }
    });

    return updates;
  });
}
