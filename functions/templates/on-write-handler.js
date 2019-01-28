const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');

/**
* Factory for template on write handler
* @param  {firebaseAdmin.database} - Firebase Admin DB instance
* @return {Function} - property onWrite handler
*/
module.exports = function createOnWriteHandler(db) {
  return (change,event) => {
    const templateId = event.params.objectId;

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
      log.info('template removed');
      return propertyTemplates.remove(db, templateId);
    }

    return propertyTemplates.update(db, templateId, change.after.val());
  };
}
