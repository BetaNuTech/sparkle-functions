const log = require('../../utils/logger');

const PREFIX = 'property-templates: utils: remove:';

/**
 * Remove a template or attribute from all
 * properties in `/propertyTemplatesList`
 * @param  {firebaseAdmin.database}
 * @param  {String} templateId
 * @param  {String} attribute
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function remove(db, templateId, attribute = '') {
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
};
