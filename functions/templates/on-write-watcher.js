const assert = require('assert');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const templatesList = require('./utils/list');

const PREFIX = 'templates: on-write:';

/**
 * Factory for template on write handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onWrite handler
 */
module.exports = function createOnWriteWatcher(db, fs) {
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return async (change, event) => {
    const { templateId } = event.params;

    if (!templateId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "templateId"`);
      return;
    }

    const beforeData = change.before.val();
    const afterData = change.after.val();

    try {
      await templatesList.write(db, fs, templateId, beforeData, afterData);
    } catch (err) {
      log.error(`${PREFIX} Failed to sync proxies | ${err}`);
    }

    // Delete template proxies
    if (beforeData && !afterData) {
      try {
        await propertyTemplates.remove(db, templateId);
        log.info(`${PREFIX} template ${templateId} removed`);
      } catch (err) {
        log.error(`${PREFIX} property template proxy remove failed | ${err}`);
      }
    }

    // Create or update template proxies
    if (afterData) {
      try {
        await propertyTemplates.upsert(db, templateId, afterData);
        log.info(
          `${PREFIX} template ${templateId} ${beforeData ? 'updated' : 'added'}`
        );
      } catch (err) {
        log.error(`${PREFIX} property template proxy upsert failed | ${err}`);
      }
    }
  };
};
