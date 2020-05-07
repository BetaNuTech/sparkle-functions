const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const usersModel = require('../models/users');

(async () => {
  await utils.forEachChild(db, '/users', async (id, data) => {
    log.info(`Syncing user "${id}"`);

    try {
      await usersModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync user "${id}" to Firestore`);
    }
  });

  log.info('Completed users sync successfully');
  process.exit();
})();
