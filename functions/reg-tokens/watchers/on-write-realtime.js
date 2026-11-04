const assert = require('assert');
const log = require('../../utils/logger');
const tokensModel = require('../../models/registration-tokens');

const PREFIX = 'reg-tokens: watchers: on-write-realtime:';

/**
 * Mirror registration tokens written to the
 * Realtime Database at `/registrationTokens/{userId}`
 * into the canonical Firestore `registrationTokens`
 * collection, which push publishing reads.
 *
 * Released iOS builds write tokens to the Realtime
 * Database. Only tokens added or refreshed by this
 * write are copied, so a token removed from Firestore
 * (outdated, or rejected by FCM) is not brought back
 * until a device registers it again.
 *
 * TODO: remove once all supported iOS builds
 * write their tokens to Firestore directly
 * @param  {admin.firestore} db
 * @return {Function} - Realtime Database onWrite handler
 */
module.exports = function createOnWriteRealtime(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { userId } = event.params;
    const before = (change.before.exists() && change.before.val()) || {};
    const after = (change.after.exists() && change.after.val()) || {};

    if (typeof after !== 'object') {
      return;
    }

    const tokens = Object.keys(after).reduce((acc, token) => {
      const value = after[token];
      const isAddedOrRefreshed = before[token] !== value;
      if (isAddedOrRefreshed) {
        acc[token] = toUnixTimestamp(value);
      }
      return acc;
    }, {});

    if (!Object.keys(tokens).length) {
      return;
    }

    try {
      await tokensModel.upsertTokens(db, userId, tokens);
    } catch (err) {
      throw Error(
        `${PREFIX} failed to mirror registration tokens of user: "${userId}" | ${err}`
      );
    }

    log.info(
      `${PREFIX} mirrored ${
        Object.keys(tokens).length
      } registration token(s) of user: "${userId}"`
    );
  };
};

/**
 * iOS writes `Date().timeIntervalSince1970`, a float
 * in seconds. Older clients wrote `true`
 * @param  {any} value
 * @return {Number} - unix timestamp in seconds
 */
function toUnixTimestamp(value) {
  if (typeof value === 'number' && value > 0) {
    return Math.round(value);
  }
  return Math.round(Date.now() / 1000);
}
