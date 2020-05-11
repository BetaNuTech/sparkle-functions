const assert = require('assert');
const log = require('../utils/logger');
const teamsModel = require('../models/teams');

const PREFIX = 'teams: write:';

/**
 * Factory team delete handlers
 * TODO: Deprecate handle when Realtime DB
 *       support is dropped
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - team write handler
 */
module.exports = function onTeamWrite(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { teamId } = event.params;

    if (!teamId) {
      log.error(`${PREFIX} incorrectly defined event parameter "teamId"`);
      return;
    }

    // Team deleted, exit
    if (!change.after.exists()) {
      return;
    }

    const beforeData = change.before.val();
    const afterData = change.after.val();

    // Sync firestore team
    try {
      const upsert = { ...afterData };

      // Mark team's properties for removal
      if (beforeData && beforeData.properties && !afterData.properties) {
        upsert.properties = null;
      }

      await teamsModel.firestoreUpsertRecord(fs, teamId, upsert);
    } catch (err) {
      log.error(`${PREFIX} failed to upsert team record: "${teamId}" | ${err}`);
      throw err;
    }
  };
};
