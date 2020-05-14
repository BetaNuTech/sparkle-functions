const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const templatesModel = require('../models/templates');

(async () => {
  await utils.forEachChild(db, '/templates', async (id, data) => {
    log.info(`Syncing template "${id}"`);

    try {
      await templatesModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync template "${id}" to Firestore`);
    }
  });

  log.info('Completed template sync successfully');
  process.exit();
})();
