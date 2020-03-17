const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const templatesModel = require('../models/templates');

(async () => {
  await utils.forEachChild(db, '/templates', async (id, template) => {
    log.info(`Syning template "${id}"`);

    try {
      await templatesModel.firestoreUpsertRecord(fs, id, template);
    } catch (err) {
      log.error(`Failed to sync template "${id}" to Firestore`);
    }
  });

  log.info('Completed successfully');
  process.exit();
})();
