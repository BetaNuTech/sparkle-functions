const assert = require('assert');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

const PREFIX = 'properties: on-template-write:';

/**
 * Factory for property template on write handler
 * @param  {firebaseAdmin.database} - Allow interface for tests
 * @return {function} - handler
 */
module.exports = function createOnTemplatesWriteHandler(db) {
  assert(Boolean(db), 'has firebase admin database instance');

  return async (change, event) => {
    const { propertyId } = event.params;

    if (!propertyId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "propertyId"`);
      return;
    }

    // Property's templates deleted
    if (change.before.exists() && !change.after.exists()) {
      try {
        await propertyTemplates.removeForProperty(db, propertyId);
        log.info(`${PREFIX} all /properties/${propertyId} templates removed`);
        return;
      } catch (err) {
        log.error(`${PREFIX} property template proxy removal failed | ${err}`);
        throw err;
      }
    }

    // Create/update property template proxies
    return propertyTemplates.processWrite(db, propertyId, change.after.val());
  };
};
