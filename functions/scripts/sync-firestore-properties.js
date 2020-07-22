const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const utils = require('../utils/firebase-admin');
const propertiesModel = require('../models/properties');
const templatesModel = require('../models/templates');
const properties = require('../properties');

(async () => {
  await utils.forEachChild(db, '/properties', async (id, data) => {
    log.info(`Syncing property "${id}"`);

    try {
      await propertiesModel.firestoreUpsertRecord(fs, id, data);
    } catch (err) {
      log.error(`Failed to sync property "${id}" to Firestore | ${err}`);
    }

    try {
      await propertiesModel.updateMetaData(fs, id);
    } catch (err) {
      log.error(`Failed to sync firestore property "${id}" meta data | ${err}`);
    }

    try {
      await properties.utils.processMeta(db, id);
    } catch (err) {
      log.error(`Failed to sync realtime property "${id}" meta data | ${err}`);
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
