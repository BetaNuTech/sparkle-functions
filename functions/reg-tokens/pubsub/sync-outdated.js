const assert = require('assert');
const log = require('../../utils/logger');
const tokensModel = require('../../models/registration-tokens');

const PREFIX = 'reg-tokens: pubsub: sync-outdated:';
const OUTDATED_OFFSET = 2629800; // seconds in 1 month

/**
 * Sync registration tokens with booleans
 * to timestamps and remove old unused tokens
 * @param  {admin.firestore} fs
 * @param  {functions.pubsub} pubSub
 * @param  {String} topic
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncOudated(fs, pubsub, topic) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');

  return pubsub.topic(topic).onPublish(async () => {
    const now = Math.round(Date.now() / 1000);
    const maxTimestamp = now - OUTDATED_OFFSET;

    try {
      await tokensModel.removeOutdated(fs, maxTimestamp);
    } catch (err) {
      log.error(`${PREFIX} failed to remove outdated failed | ${err}`);
    }
  });
};
