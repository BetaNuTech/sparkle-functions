const co = require('co');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
const findRemovedKeys = require('../utils/find-removed-keys');

LOG_PREFIX = 'property-templates:';

module.exports = {
 /**
  * Add property's templates to `/propertyTemplates` & `/propertyTemplatesList`
  * @param  {firebaseAdmin.database}
  * @param  {String} propertyId
  * @param  {Object} templatesHash
  * @return {Promise} - resolves {Object} hash of updates
  */
  processWrite(database, propertyId, templatesHash) {
    const self = this;
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
        const templateCopy = self._toTemplateProxy(template);
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
   * Create or update existing proxys in
   * `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {Object} template
   * @return {Promise} - resolves {Object} updates hash
   */
  upsert(db, templateId, template) {
    const updates = {};
    const templateCopy = this._toTemplateProxy(template);

    return co(function *() {
      const allPropertyIds = yield adminUtils.fetchRecordIds(db, '/properties');
      const templatesPropertyIds = [];

      // Collect all properties associated with template
      for (var i = 0; i < allPropertyIds.length; i++) {
        const propertyId = allPropertyIds[i];
        const propertyTemplateIds = yield adminUtils.fetchRecordIds(db, `/properties/${propertyId}/templates`);

        if (propertyTemplateIds.includes(templateId)) {
          templatesPropertyIds.push(propertyId);
        }
      }

      // Upsert all templates proxies
      for (i = 0; i < templatesPropertyIds.length; i++) {
        const propertyId = templatesPropertyIds[i];

        const target = `/propertyTemplates/${propertyId}/${templateId}`;
        yield db.ref(target).set(templateCopy);
        log.info(`${LOG_PREFIX} upsert: template at ${target}`);
        updates[target] = 'upsert';

        const targetList = `/propertyTemplatesList/${propertyId}/${templateId}`;
        yield db.ref(targetList).set(templateCopy);
        log.info(`${LOG_PREFIX} upsert: template at ${targetList}`);
        updates[targetList] = 'upsert';
      }

      return updates;
    });
  },

  /**
   * Remove a template or attribute from all
   * properties in `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {String} attribute
   * @return {Promise} - resolves {Object} hash of updates
   */
  remove(db, templateId, attribute = '') {
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
          const target = `/propertyTemplates/${propertyId}/${templateId}${attribute}`;
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
          const target = `/propertyTemplatesList/${propertyId}/${templateId}${attribute}`;
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
  },

  /**
   * Copy specified template attributes into an
   * abbreviated proxy record
   * @param  {Object} template
   * @return {Object} - template copy
   */
  _toTemplateProxy(template) {
    const templateCopy = Object.create(null);

    // Required attributes
    templateCopy.name = template.name || '';

    // Add optional attributes
    if (template.description) {
      templateCopy.description = template.description;
    }

    if (template.category) {
      templateCopy.category = template.category;
    }

    return templateCopy;
  }
};
