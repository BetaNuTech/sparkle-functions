const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

module.exports = {
  /**
   * Factory for property template on write handler
   * @param  {firebaseAdmin.database} - Allow interface for tests
   * @return {function}
   */
  templatesOnWriteHandler(db) {
    return (change, event) => co(function *() {
      const propertyId = event.params.objectId;

      // Delete onWrite event?
      if (change.before.exists() && !change.after.exists()) {
        log.info(`all /properties/${propertyId} templates removed`);
        yield db.ref(`/propertyTemplates/${propertyId}`).remove()
        return { [`/propertyTemplates/${propertyId}`]: 'removed' };
      }

      return propertyTemplates.processWrite(db, propertyId, change.after.val());
    });
  }
}
