const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const templatesList = require('./list');

const LOG_PREFIX = 'templates: on-write-handler:';

/**
* Factory for template on write handler
* @param  {firebaseAdmin.database} - Firebase Admin DB instance
* @return {Function} - property onWrite handler
*/
module.exports = function createOnWriteHandler(db) {
  return (change, event) => co(function *() {
    const templateId = event.params.objectId;
    const beforeData = change.before.val();
    const afterData = change.after.val();

    try {
      yield templatesList.write(
        db,
        templateId,
        beforeData,
        afterData
      );
    } catch (e) {
      log.error(e);
    }

    // Delete template proxies
    if (beforeData && !afterData) {
      log.info(`${LOG_PREFIX} template ${templateId} removed`);
      return propertyTemplates.remove(db, templateId);
    }

    // Create or update template proxies
    if (afterData) {
      log.info(`${LOG_PREFIX} template ${templateId} ${beforeData ? 'updated' : 'added'}`);
      return propertyTemplates.upsert(db, templateId, afterData);
    }

    return {};
  });
}
