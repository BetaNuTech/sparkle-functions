const log = require('../utils/logger');
const findRemovedKeys = require('../utils/find-removed-keys');

module.exports = {
 /**
  * Add property's templates to `/propertyTemplates`
  * @param  {firebaseAdmin.database}
  * @param  {String} propertyId
  * @param  {Object} templatesHash
  * @return {Promise} - resolves {Object} hash of updats
  */
  processWrite(database, propertyId, templatesHash) {
    if (templatesHash != null) { // TODO reduce acyclical complexity
      const updates = {};
      log.info(`Writing to /propertyTemplates/${propertyId} with count: ${Object.keys(templatesHash).length}`);

      // TODO: fix potential race condition here:
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
          var templatesRemoved = findRemovedKeys(templatesSnapshot.val(), templatesHash); // Array of template keys
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
  },

  /**
   * Update existing template in /propertyTemplates
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {Object} template
   * @return {Promise} - resolves {Object} updates hash
   */
  update(database, templateId, template) {
    var templateCopy = {};

    templateCopy['name'] = template.name;
    if (templateCopy['name'] == null) {
      templateCopy['name'] = '';
    }

    templateCopy['description'] = template.description;
    if (templateCopy['description'] == null) {
      templateCopy['description'] = '';
    }

    return database.ref('/propertyTemplates').once('value').then(function(propertyTemplatesSnapshot) {
      if (propertyTemplatesSnapshot.exists()) {
        var propertyTemplates = propertyTemplatesSnapshot.val();
        return Promise.all(Object.keys(propertyTemplates).map(function(propertyId) {
          if (propertyTemplates[propertyId][templateId] != null) {
            return database.ref('/propertyTemplates').child(propertyId).child(templateId).set(templateCopy)
            .then(() => {
              log.info(`template updated at /propertyTemplates/${propertyId}/${templateId}`);
              return { [`/propertyTemplates/${propertyId}/${templateId}`]: 'updated' }
            })
          }
          return Promise.resolve({});
        }))
        .then(result => {
          const updates = {};
          result.forEach(update => Object.assign(updates, update));
          return updates;
        });
      }

      return Promise.resolve({});
    });
  },

  /**
   * Remove a template from all properties in `/propertyTemplates`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @return {Promise} - resolves {Object} hash of updates
   */
  remove(database, templateId) {
    return database.ref('/propertyTemplates').once('value').then(function(propertyTemplatesSnapshot) {
      if (propertyTemplatesSnapshot.exists()) {
        var propertyTemplates = propertyTemplatesSnapshot.val();
        return Promise.all(Object.keys(propertyTemplates).map(propertyId => {
          if (propertyTemplates[propertyId][templateId] != null) {
            return database.ref('/propertyTemplates').child(propertyId).child(templateId).remove()
            .then(() => {
              log.info(`template removed /propertyTemplates/${propertyId}`);
              return { [`/propertyTemplates/${propertyId}/${templateId}`]: 'removed' }
            })
          }
          return Promise.resolve({});
        }))
        .then(result => {
          const updates = {};
          result.forEach(update => Object.assign(updates, update));
          return updates;
        });
      }

      return Promise.resolve({});
    });
  }
};
