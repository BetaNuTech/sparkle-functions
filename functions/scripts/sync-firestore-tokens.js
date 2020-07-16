const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const regTokenModel = require('../models/registration-tokens');

(async () => {
  await utils.forEachChild(db, '/registrationTokens', async (id, data) => {
    log.info(`Syncing user "${id}" registration tokens`);

    try {
      await regTokenModel.firestoreCreateRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync user "${id}" tokens to Firestore`);
    }
  });

  log.info('Completed user registration token sync successfully');
  process.exit();
})();
