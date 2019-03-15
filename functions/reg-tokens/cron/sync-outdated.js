const log = require('../../utils/logger');

const LOG_PREFIX = 'reg-tokens: cron: sync-outdated:';

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
  });
}
