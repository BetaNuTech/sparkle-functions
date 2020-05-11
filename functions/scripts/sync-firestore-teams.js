const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const teamsModel = require('../models/teams');

(async () => {
  await utils.forEachChild(db, '/teams', async (id, data) => {
    log.info(`Syning team "${id}"`);

    try {
      await teamsModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync team "${id}" to Firestore`);
    }
  });

  log.info('Completed team sync successfully');
  process.exit();
})();
