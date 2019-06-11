const assert = require('assert');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'properties: on-template-write:';

/**
 * Factory for property template on write handler
 * @param  {firebaseAdmin.database} - Allow interface for tests
 * @return {function} - handler
 */
module.exports = function createOnTemplatesWriteHandler(db) {
  assert(Boolean(db), 'has firebase admin database instance');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId } = event.params;

    if (!propertyId) {
      log.warn(
        `${LOG_PREFIX} incorrectly defined event parameter "propertyId"`
      );
      return;
    }

    // Property's templates deleted
    if (change.before.exists() && !change.after.exists()) {
      await propertyTemplates.removeForProperty(db, propertyId);
      log.info(`${LOG_PREFIX} all /properties/${propertyId} templates removed`);
      updates[`/propertyTemplates/${propertyId}`] = 'removed'; // TODO remove #53
      updates[`/propertyTemplatesList/${propertyId}`] = 'removed'; // TODO remove #53
      return updates;
    }

    // Create/update property template proxies
    return propertyTemplates.processWrite(db, propertyId, change.after.val());
  };
};
