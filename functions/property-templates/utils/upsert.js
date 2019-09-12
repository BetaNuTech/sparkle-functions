const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const createProxy = require('./create-proxy');

const PREFIX = 'property-templates: utils: upsert:';

/**
 * Create or update existing proxys in
 * `/propertyTemplatesList`
 * @param  {firebaseAdmin.database}
 * @param  {String} templateId
 * @param  {Object} template
 * @return {Promise} - resolves {Object} updates hash
 */
module.exports = async function upsert(db, templateId, template) {
  const updates = {};
  const templateCopy = createProxy(template);

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
};
