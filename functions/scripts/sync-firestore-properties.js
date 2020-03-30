const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const propertiesModel = require('../models/properties');

(async () => {
  await utils.forEachChild(db, '/properties', async (id, data) => {
    log.info(`Syning property "${id}"`);

    try {
      await propertiesModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync property "${id}" to Firestore`);
    }
  });

  log.info('Completed property sync successfully');
  process.exit();
})();
