const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const propertiesModel = require('../models/properties');
const templatesModel = require('../models/templates');
const properties = require('../properties');

(async () => {
  await utils.forEachChild(db, '/properties', async (id, data) => {
    if (id !== '-LzNJq6Qj5QfodyxlWxy') return; // TODO: remove
    log.info(`Syning property "${id}"`);

    try {
      await propertiesModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync property "${id}" to Firestore | ${err}`);
    }

    try {
      await properties.utils.processMeta(db, fs, id);
    } catch (err) {
      log.error(`Failed to sync property "${id}" meta data | ${err}`);
    }

    try {
      const templates = Object.keys(data.templates || {}) || [];
      if (templates.length) {
        await templatesModel.updatePropertyRelationships(fs, id, [], templates);
      }
    } catch (err) {
      log.error(
        `Failed to sync property "${id}" template relationships to Firestore | ${err}`
      );
    }
  });

  log.info('Completed property sync successfully');
  process.exit();
})();
