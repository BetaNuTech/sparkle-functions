const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const createOnWriteHandler = require('./on-write-handler');

module.exports = {
  /**
   * Factory for property template on write handler
   * @param  {firebaseAdmin.database} - Allow interface for tests
   * @return {function}
   */
  templatesOnWriteHandler(db) {
    return (change, event) => co(function *() {
      const propertyId = event.params.objectId;

      // Property's templates deleted
      if (change.before.exists() && !change.after.exists()) {
        log.info(`all /properties/${propertyId} templates removed`);
        yield propertyTemplates.removeForProperty(db, propertyId);

        return {
          [`/propertyTemplates/${propertyId}`]: 'removed',
          [`/propertyTemplatesList/${propertyId}`]: 'removed'
        };
      }

      return propertyTemplates.processWrite(db, propertyId, change.after.val());
    });
  },

  createOnWriteHandler
}
