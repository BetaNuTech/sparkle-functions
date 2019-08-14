const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
const findRemovedKeys = require('../utils/find-removed-keys');

const PREFIX = 'property-templates:';

module.exports = {
  /**
   * Add property's templates to `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} propertyId
   * @param  {Object} templatesHash
   * @return {Promise} - resolves {Object} hash of updates
   */
  async processWrite(db, propertyId, templatesHash) {
    const updates = {};
    const templateKeys = Object.keys(templatesHash || {});

    if (templateKeys.length === 0) {
      return Promise.resolve(updates);
    }

    log.info(
      `${PREFIX} Writing to /propertyTemplatesList/${propertyId} with count: ${templateKeys.length}`
    );

    for (let i = 0; i < templateKeys.length; i++) {
      const templateId = templateKeys[i];
      const templateSnapshot = await db
        .ref(`/templates/${templateId}`)
        .once('value');

      if (!templateSnapshot.exists()) {
        continue; // eslint-disable-line no-continue
      }

      try {
        const template = templateSnapshot.val(); // Assumed hash data, with no children
        const templateCopy = this._toTemplateProxy(template); // eslint-disable-line no-underscore-dangle
        await db
          .ref(`/propertyTemplatesList/${propertyId}/${templateId}`)
          .set(templateCopy);
        updates[`/propertyTemplatesList/${propertyId}/${templateId}`] =
          'upserted';
      } catch (err) {
        log.error(
          `${PREFIX} processWrite: failed for property ${propertyId} with template: ${templateId} | ${err}`
        );
      }
    }

    try {
      // Check updated /propertyTemplatesList to remove templates that shouldn't be there
      const propTmplsListSnap = await db
        .ref(`/propertyTemplatesList/${propertyId}`)
        .once('value');

      if (propTmplsListSnap.exists()) {
        const templatesListRemoved = findRemovedKeys(
          propTmplsListSnap.val(),
          templatesHash
        ); // Array of template keys

        if (templatesListRemoved.length > 0) {
          log.info(
            `${PREFIX} /propertyTemplatesList removed count: ${templatesListRemoved.length}`
          );

          await Promise.all(
            templatesListRemoved.map(id => {
              updates[`/propertyTemplatesList/${propertyId}/${id}`] = 'removed';
              return db
                .ref(`/propertyTemplatesList/${propertyId}/${id}`)
                .remove();
            })
          );
        }
      }
    } catch (err) {
      log.error(`${PREFIX} processWrite failed to remove proxies: ${err}`);
    }

    return updates;
  },

  /**
   * Create or update existing proxys in
   * `/propertyTemplatesList`
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
          `${PREFIX} upsert: "properties/${propertyId}/templates" lookup failed | ${err}`
        );
      }
    }

    // Upsert all templates proxies
    for (let i = 0; i < templatesPropertyIds.length; i++) {
      const propertyId = templatesPropertyIds[i];

      try {
        const target = `/propertyTemplatesList/${propertyId}/${templateId}`;
        await db.ref(target).set(templateCopy);
        log.info(`${PREFIX} upsert: template at ${target}`);
        updates[target] = 'upsert';
      } catch (err) {
        log.error(`${PREFIX} upsert: proxy upsert failed | ${err}`);
      }
    }

    return updates;
  },

  /**
   * Remove a template or attribute from all
   * properties in `/propertyTemplatesList`
   * @param  {firebaseAdmin.database}
   * @param  {String} templateId
   * @param  {String} attribute
   * @return {Promise} - resolves {Object} hash of updates
   */
  async remove(db, templateId, attribute = '') {
    const updates = {};
    let propTmplsListSnap = null;

    try {
      propTmplsListSnap = await db.ref('/propertyTemplatesList').once('value');
    } catch (err) {
      throw Error(`${PREFIX} remove: lookup failed | ${err}`);
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
          log.info(`${PREFIX} remove: successfully removed ${target}`);
          updates[target] = 'removed';
        } catch (err) {
          log.error(`${PREFIX} remove: failed to remove ${target} | ${err}`);
        }
      }
    }

    return updates;
  },

  /**
   * Remove all template proxies belonging to a property
   * @param  {firebaseAdmin.database}
   * @param  {String} propertyId
   * @return {Promise} - resolves {Boolean} remove() results
   */
  removeForProperty(db, propertyId) {
    return db.ref(`/propertyTemplatesList/${propertyId}`).remove();
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
