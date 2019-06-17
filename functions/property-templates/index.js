const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
const findRemovedKeys = require('../utils/find-removed-keys');

const LOG_PREFIX = 'property-templates:';

module.exports = {
  /**
   * Add property's templates to `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} propertyId
   * @param  {Object} templatesHash
   * @return {Promise} - resolves {Object} hash of updates
   */
  async processWrite(database, propertyId, templatesHash) {
    const updates = {};
    const templateKeys = Object.keys(templatesHash || {});

    if (templateKeys.length === 0) {
      return Promise.resolve(updates);
    }

    log.info(
      `${LOG_PREFIX} Writing to /propertyTemplates/${propertyId} with count: ${templateKeys.length}`
    );

    for (let i = 0; i < templateKeys.length; i++) {
      const templateId = templateKeys[i];
      const templateSnapshot = await database
        .ref(`/templates/${templateId}`)
        .once('value');

      if (!templateSnapshot.exists()) {
        continue; // eslint-disable-line no-continue
      }

      try {
        const template = templateSnapshot.val(); // Assumed hash data, with no children
        const templateCopy = this._toTemplateProxy(template); // eslint-disable-line no-underscore-dangle
        await database
          .ref(`/propertyTemplates/${propertyId}/${templateId}`)
          .set(templateCopy);
        await database
          .ref(`/propertyTemplatesList/${propertyId}/${templateId}`)
          .set(templateCopy);
        updates[`/propertyTemplates/${propertyId}/${templateId}`] = 'upserted';
        updates[`/propertyTemplatesList/${propertyId}/${templateId}`] =
          'upserted';
      } catch (err) {
        log.error(
          `${LOG_PREFIX} processWrite: failed for property ${propertyId} with template: ${templateId} | ${err}`
        );
      }
    }

    // Check updated /propertyTemplates to remove templates that shouldn't be there
    try {
      const propTmplsSnap = await database
        .ref(`/propertyTemplates/${propertyId}`)
        .once('value');

      if (propTmplsSnap.exists()) {
        const templatesRemoved = findRemovedKeys(
          propTmplsSnap.val(),
          templatesHash
        ); // Array of template keys

        if (templatesRemoved.length > 0) {
          log.info(
            `${LOG_PREFIX} /propertyTemplates removed count: ${templatesRemoved.length}`
          );

          await Promise.all(
            templatesRemoved.map(id => {
              updates[`/propertyTemplates/${propertyId}/${id}`] = 'removed';
              return database
                .ref(`/propertyTemplates/${propertyId}/${id}`)
                .remove();
            })
          );
        }
      }

      // Check updated /propertyTemplates to remove templates that shouldn't be there
      const propTmplsListSnap = await database
        .ref(`/propertyTemplatesList/${propertyId}`)
        .once('value');

      if (propTmplsListSnap.exists()) {
        const templatesListRemoved = findRemovedKeys(
          propTmplsListSnap.val(),
          templatesHash
        ); // Array of template keys

        if (templatesListRemoved.length > 0) {
          log.info(
            `${LOG_PREFIX} /propertyTemplatesList removed count: ${templatesListRemoved.length}`
          );

          await Promise.all(
            templatesListRemoved.map(id => {
              updates[`/propertyTemplatesList/${propertyId}/${id}`] = 'removed';
              return database
                .ref(`/propertyTemplatesList/${propertyId}/${id}`)
                .remove();
            })
          );
        }
      }
    } catch (err) {
      log.error(`${LOG_PREFIX} processWrite: ${err}`);
    }

    return updates;
  },

  /**
   * Create or update existing proxys in
   * `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {Object} template
   * @return {Promise} - resolves {Object} updates hash
   */
  async upsert(db, templateId, template) {
    const updates = {};
    const templateCopy = this._toTemplateProxy(template); // eslint-disable-line no-underscore-dangle

    const allPropertyIds = await adminUtils.fetchRecordIds(db, '/properties');
    const templatesPropertyIds = [];

    // Collect all properties associated with template
    for (let i = 0; i < allPropertyIds.length; i++) {
      const propertyId = allPropertyIds[i];

      try {
        const propertyTemplateIds = await adminUtils.fetchRecordIds(
          db,
          `/properties/${propertyId}/templates`
        );

        if (propertyTemplateIds.includes(templateId)) {
          templatesPropertyIds.push(propertyId);
        }
      } catch (err) {
        log.error(
          `${LOG_PREFIX} upsert: "properties/${propertyId}/templates" lookup failed | ${err}`
        );
      }
    }

    // Upsert all templates proxies
    for (let i = 0; i < templatesPropertyIds.length; i++) {
      const propertyId = templatesPropertyIds[i];

      try {
        const target = `/propertyTemplates/${propertyId}/${templateId}`;
        await db.ref(target).set(templateCopy);
        log.info(`${LOG_PREFIX} upsert: template at ${target}`);
        updates[target] = 'upsert';

        const targetList = `/propertyTemplatesList/${propertyId}/${templateId}`;
        await db.ref(targetList).set(templateCopy);
        log.info(`${LOG_PREFIX} upsert: template at ${targetList}`);
        updates[targetList] = 'upsert';
      } catch (err) {
        log.error(`${LOG_PREFIX} upsert: proxy upsert failed | ${err}`);
      }
    }

    return updates;
  },

  /**
   * Remove a template or attribute from all
   * properties in `/propertyTemplates` & `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {String} attribute
   * @return {Promise} - resolves {Object} hash of updates
   */
  async remove(db, templateId, attribute = '') {
    const updates = {};
    let propTmplsSnap = null;
    let propTmplsListSnap = null;

    try {
      propTmplsSnap = await db.ref('/propertyTemplates').once('value');
      propTmplsListSnap = await db.ref('/propertyTemplatesList').once('value');
    } catch (err) {
      throw Error(`${LOG_PREFIX} remove: lookup failed | ${err}`);
    }

    // Remove in `/propertyTemplates`
    if (propTmplsSnap.exists()) {
      const propertyTemplates = propTmplsSnap.val();
      const activePropertyIds = Object.keys(propertyTemplates).filter(
        propertyId => propertyTemplates[propertyId][templateId]
      );

      for (let i = 0; i < activePropertyIds.length; i++) {
        const propertyId = activePropertyIds[i];
        const target = `/propertyTemplates/${propertyId}/${templateId}${attribute}`;

        try {
          await db.ref(target).remove();
          log.info(`${LOG_PREFIX} remove: successfully removed ${target}`);
          updates[target] = 'removed';
        } catch (err) {
          log.error(
            `${LOG_PREFIX} remove: failed to remove ${target} | ${err}`
          );
        }
      }
    }

    // Remove in `/propertyTemplatesList`
    if (propTmplsListSnap.exists()) {
      const propertyTemplatesList = propTmplsListSnap.val();
      const activePropertyIds = Object.keys(propertyTemplatesList).filter(
        propertyId => propertyTemplatesList[propertyId][templateId]
      );

      for (let i = 0; i < activePropertyIds.length; i++) {
        const propertyId = activePropertyIds[i];
        const target = `/propertyTemplatesList/${propertyId}/${templateId}${attribute}`;

        try {
          await db.ref(target).remove();
          log.info(`${LOG_PREFIX} remove: successfully removed ${target}`);
          updates[target] = 'removed';
        } catch (err) {
          log.error(
            `${LOG_PREFIX} remove: failed to remove ${target} | ${err}`
          );
        }
      }
    }

    return updates;
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
      db.ref(`/propertyTemplatesList/${propertyId}`).remove(),
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
  },
};
