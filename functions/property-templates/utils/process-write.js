const log = require('../../utils/logger');
const findRemovedKeys = require('../../utils/find-removed-keys');
const createProxy = require('./create-proxy');

const PREFIX = 'property-templates: utils: process-write:';

/**
 * Add property's templates to `/propertyTemplatesList`
 * @param  {firebaseAdmin.database}
 * @param  {String} propertyId
 * @param  {Object} templatesHash
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function processWrite(db, propertyId, templatesHash) {
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
      const templateCopy = createProxy(template); // eslint-disable-line no-underscore-dangle
      await db
        .ref(`/propertyTemplatesList/${propertyId}/${templateId}`)
        .set(templateCopy);
      updates[`/propertyTemplatesList/${propertyId}/${templateId}`] =
        'upserted';
    } catch (err) {
      log.error(
        `${PREFIX} failed for property ${propertyId} with template: ${templateId} | ${err}`
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
    log.error(`${PREFIX} failed to remove proxies | ${err}`);
  }

  return updates;
};
