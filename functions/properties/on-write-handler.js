const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const findRemovedKeys = require('../utils/find-removed-keys');

/**
 * Factory for property on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnWriteHandler(db) {
  return (change,event) => {
    const propertyId = event.params.objectId;

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
      log.info('property removed');
      var templatesRemoved = change.before.val().templates;
      if (templatesRemoved != null) {
        return Promise.all(Object.keys(templatesRemoved).map(templateKey =>
          db.ref('/propertyTemplates').child(propertyId).child(templateKey).remove()
          .then(() => ({ [`/propertyTemplates/${propertyId}/${templateKey}`]: 'removed' }))
        ))
        .then(result => {
          const updates = {};
          result.forEach(update => Object.assign(updates, update));
          return updates;
        });
      }

      return Promise.resolve({});
    }

    return propertyTemplates.processWrite(db, propertyId, change.after.val().templates);
  };
}
