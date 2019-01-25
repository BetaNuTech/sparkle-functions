const log = require('../utils/logger');
const templates = require('../templates');

module.exports = {
 /**
  * Add property's templates to `/propertyTemplates`
  * @param  {firebaseAdmin.database}
  * @param  {String} propertyId
  * @param  {Object} templatesHash
  * @return {Promise} - resolves {Object} hash of updats
  */
  processWrite(database, propertyId, templatesHash) {
    if (templatesHash != null) {
      const updates = {};
      log.info('Writing to /propertyTemplates/', propertyId, ' with count: ', Object.keys(templatesHash).length);
      Object.keys(templatesHash).forEach(function(templateKey) {
        database.ref('/templates').child(templateKey).once('value').then(function(templateSnapshot) {
          if (templateSnapshot.exists()) {
            var template = templateSnapshot.val(); // Assumed hash data, with no children
            var templateCopy = {};
            templateCopy['name'] = template.name;
            if (templateCopy['name'] == null) {
              templateCopy['name'] = '';
            }
            templateCopy['description'] = template.description;
            if (templateCopy['description'] == null) {
              templateCopy['description'] = '';
            }
            database.ref('/propertyTemplates').child(propertyId).child(templateKey).set(templateCopy);
            updates[`/propertyTemplates/${propertyId}/${templateKey}`] = 'upserted';
          }
        });
      });

      // Check updated propertyTemplates to remove templates that shouldn't be there
      return database.ref('/propertyTemplates').child(propertyId).once('value').then(function(templatesSnapshot) {
        if (templatesSnapshot.exists()) {
          var templatesRemoved = templates.findRemoved(templatesSnapshot.val(), templatesHash); // Array of template keys
          if (templatesRemoved.length > 0) {
            log.info('templates removed count: ', templatesRemoved.length);
            return Promise.all(templatesRemoved.map(templateKey =>
              database.ref('/propertyTemplates').child(propertyId).child(templateKey).remove()
              .then(() => {
                updates[`/propertyTemplates/${propertyId}/${templateKey}`] = 'removed';
              })
            ));
          }
        }
      }).then(() => updates);
    }

    return [];
  }
};
