const co = require('co');
const log = require('../utils/logger');
const findRemovedKeys = require('../utils/find-removed-keys');

module.exports = {
 /**
  * Add property's templates to `/propertyTemplates` & `/propertyTemplatesList`
  * @param  {firebaseAdmin.database}
  * @param  {String} propertyId
  * @param  {Object} templatesHash
  * @return {Promise} - resolves {Object} hash of updats
  */
  processWrite(database, propertyId, templatesHash) {
    const updates = {};
    const templateKeys = Object.keys(templatesHash || {});

    if (templateKeys.length === 0) {
      return Promise.resolve(updates);
    }

    log.info(`Writing to /propertyTemplates/${propertyId} with count: ${templateKeys.length}`);

    return co(function *() {
      for (var i = 0; i < templateKeys.length; i++) {
        const templateId = templateKeys[i];
        const templateSnapshot = yield database.ref(`/templates/${templateId}`).once('value');

        if (!templateSnapshot.exists()) {
          continue;
        }

        const template = templateSnapshot.val(); // Assumed hash data, with no children
        const templateCopy = {};

        templateCopy['name'] = template.name || '';
        templateCopy['description'] = template.description || '';

        yield database.ref(`/propertyTemplates/${propertyId}/${templateId}`).set(templateCopy);
        yield database.ref(`/propertyTemplatesList/${propertyId}/${templateId}`).set(templateCopy);
        updates[`/propertyTemplates/${propertyId}/${templateId}`] = 'upserted';
        updates[`/propertyTemplatesList/${propertyId}/${templateId}`] = 'upserted';
      }

      // Check updated /propertyTemplates to remove templates that shouldn't be there
      const propTmplsSnap = yield database.ref(`/propertyTemplates/${propertyId}`).once('value');

      if (propTmplsSnap.exists()) {
        const templatesRemoved = findRemovedKeys(propTmplsSnap.val(), templatesHash); // Array of template keys

        if (templatesRemoved.length > 0) {
          log.info(`/propertyTemplates removed count: ${templatesRemoved.length}`);

          yield Promise.all(templatesRemoved.map(id => {
            updates[`/propertyTemplates/${propertyId}/${id}`] = 'removed';
            return database.ref(`/propertyTemplates/${propertyId}/${id}`).remove();
          }));
        }
      }

      // Check updated /propertyTemplates to remove templates that shouldn't be there
      const propTmplsListSnap = yield database.ref(`/propertyTemplatesList/${propertyId}`).once('value');

      if (propTmplsListSnap.exists()) {
        const templatesListRemoved = findRemovedKeys(propTmplsListSnap.val(), templatesHash); // Array of template keys

        if (templatesListRemoved.length > 0) {
          log.info(`/propertyTemplatesList removed count: ${templatesListRemoved.length}`);

          yield Promise.all(templatesListRemoved.map(id => {
            updates[`/propertyTemplatesList/${propertyId}/${id}`] = 'removed';
            return database.ref(`/propertyTemplatesList/${propertyId}/${id}`).remove()
          }));
        }
      }

      return updates;
    });
  },

  /**
   * Update existing template in `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {Object} template
   * @return {Promise} - resolves {Object} updates hash
   */
  update(database, templateId, template) {
    const updates = {};
    const templateCopy = {};
    templateCopy['name'] = template.name || ''
    templateCopy['description'] = template.description || '';

    return co(function *() {
      const propTmplsSnap = yield database.ref('/propertyTemplates').once('value');
      const propTmplsListSnap = yield database.ref('/propertyTemplatesList').once('value');

      // Update in `/propertyTemplates`
      if (propTmplsSnap.exists()) {
        const propertyTemplates = propTmplsSnap.val();
        const activePropertyIds = Object.keys(propertyTemplates).filter((propertyId) => propertyTemplates[propertyId][templateId]);

        for (var i = 0; i < activePropertyIds.length; i++) {
          const propertyId = activePropertyIds[i];
          const target = `/propertyTemplates/${propertyId}/${templateId}`;
          yield database.ref(target).set(templateCopy);
          log.info(`template updated at ${target}`);
          updates[target] = 'updated';
        }
      }

      // Update in `/propertyTemplatesList`
      if (propTmplsListSnap.exists()) {
        const propertyTemplates = propTmplsListSnap.val();
        const activePropertyIds = Object.keys(propertyTemplates).filter((propertyId) => propertyTemplates[propertyId][templateId]);

        for (var i = 0; i < activePropertyIds.length; i++) {
          const propertyId = activePropertyIds[i];
          const target = `/propertyTemplatesList/${propertyId}/${templateId}`;
          yield database.ref(target).set(templateCopy);
          log.info(`template updated at ${target}`);
          updates[target] = 'updated';
        }
      }

      return updates;
    });
  },

  /**
   * Remove a template from all properties in `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @return {Promise} - resolves {Object} hash of updates
   */
  remove(db, templateId) {
    return co(function *() {
      const updates = {};
      const propTmplsSnap = yield db.ref('/propertyTemplates').once('value');
      const propTmplsListSnap = yield db.ref('/propertyTemplatesList').once('value');

      // Remove in `/propertyTemplates`
      if (propTmplsSnap.exists()) {
        const propertyTemplates = propTmplsSnap.val();
        const activePropertyIds = Object.keys(propertyTemplates).filter(propertyId => propertyTemplates[propertyId][templateId]);

        for (var i = 0; i < activePropertyIds.length; i++) {
          const propertyId = activePropertyIds[i];
          const target = `/propertyTemplates/${propertyId}/${templateId}`;
          yield db.ref(target).remove();
          log.info(target);
          updates[target] = 'removed';
        }
      }

      // Remove in `/propertyTemplatesList`
      if (propTmplsListSnap.exists()) {
        const propertyTemplatesList = propTmplsListSnap.val();
        const activePropertyIds = Object.keys(propertyTemplatesList).filter(propertyId => propertyTemplatesList[propertyId][templateId]);

        for (var i = 0; i < activePropertyIds.length; i++) {
          const propertyId = activePropertyIds[i];
          const target = `/propertyTemplatesList/${propertyId}/${templateId}`;
          yield db.ref(target).remove();
          log.info(`templates removed ${target}`);
          updates[target] = 'removed';
        }
      }

      return updates;
    });
  },

  /**
   * Remove all template proxies belonging to a property
   * @param  {firebaseAdmin.database}
   * @param  {String} propertyId
   * @return {Promise} - resolves {Boolean[]} remove() results
   */
  removeForProperty(db, propertyId) {
    return Promise.all([
      db.ref(`/propertyTemplates/${propertyId}`).remove(),
      db.ref(`/propertyTemplatesList/${propertyId}`).remove()
    ]);
  }
};
