const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const inspectionsModel = require('../models/inspections');

(async () => {
  await utils.forEachChild(db, '/inspections', async (id, data) => {
    log.info(`Syning inspection "${id}"`);

    try {
      await inspectionsModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync inspection "${id}" to Firestore`);
    }
  });

  log.info('Completed inspection sync successfully');
  process.exit();
})();
