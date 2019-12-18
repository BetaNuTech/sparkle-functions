const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const templatesList = require('./utils/list');

const PREFIX = 'templates: on-write:';

/**
 * Factory for template on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteWatcher(db) {
  return async (change, event) => {
    const updates = {};
    const { templateId } = event.params;

    if (!templateId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "templateId"`);
      return;
    }

    const beforeData = change.before.val();
    const afterData = change.after.val();

    try {
      await templatesList.write(db, templateId, beforeData, afterData);
    } catch (e) {
      log.error(`${PREFIX} ${e}`);
    }

    // Delete template proxies
    if (beforeData && !afterData) {
      const proTmplUpdates = await propertyTemplates.remove(db, templateId);
      log.info(`${PREFIX} template ${templateId} removed`);
      Object.assign(updates, proTmplUpdates);
    }

    // Create or update template proxies
    if (afterData) {
      const proTmplUpdates = await propertyTemplates.upsert(
        db,
        templateId,
        afterData
      );
      log.info(
        `${PREFIX} template ${templateId} ${beforeData ? 'updated' : 'added'}`
      );
      Object.assign(updates, proTmplUpdates);
    }

    return updates;
  };
};
