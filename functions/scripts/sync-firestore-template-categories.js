const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const templateCategoriesModel = require('../models/template-categories');

(async () => {
  await utils.forEachChild(db, '/templateCategories', async (id, data) => {
    log.info(`Syncing template category "${id}"`);

    try {
      await templateCategoriesModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync template category "${id}" to Firestore`);
    }
  });

  log.info('Completed template category sync successfully');
  process.exit();
})();
