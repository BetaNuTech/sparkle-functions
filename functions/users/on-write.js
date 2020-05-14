const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');

const PREFIX = 'users: on-write:';

/**
 * Factory for user on write handler
 * TODO: Deprecate when realtime db support dropped
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onWrite handler
 */
module.exports = function userOnWrite(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { userId } = event.params;

    if (!userId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "userId"`);
      return;
    }

    const updating = change.before.exists();
    const beforeData = change.before.val();
    const afterData = change.after.val();

    if (afterData) {
      // Create or update firestore record
      const writeData = { ...afterData };

      if (beforeData && beforeData.properties && !afterData.properties) {
        writeData.properties = null;
      }

      if (beforeData && beforeData.teams && !afterData.teams) {
        writeData.teams = null;
      }

      try {
        await usersModel.firestoreUpsertRecord(fs, userId, writeData);
      } catch (err) {
        log.error(
          `${PREFIX} failed to ${
            updating ? 'update' : 'create'
          } firestore user "${userId}" | ${err}`
        );
        throw err;
      }
    } else {
      // Remove firestore record
      try {
        await usersModel.firestoreRemoveRecord(fs, userId, afterData);
      } catch (err) {
        log.error(
          `${PREFIX} failed to remove firestore user "${userId}" | ${err}`
        );
        throw err;
      }
    }
  };
};
