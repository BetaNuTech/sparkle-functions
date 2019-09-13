const log = require('../../utils/logger');
const propertyTemplates = require('../../property-templates');
const adminUtils = require('../../utils/firebase-admin');

const PREFIX = 'templates: pubsub: sync-property-templates-list:';

/**
 * Sync templates with propertyTemplatesList and log
 * any orphaned records
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncPropertyTemplatesListSubscriber(
  topic = '',
  pubSub,
  db
) {
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};
    log.info(
      `${PREFIX} ${topic} received at: ${Math.round(Date.now() / 1000)}`
    );

    // Add missing/outdated templatesList records
    await adminUtils.forEachChild(
      db,
      '/templates',
      async function propertyTemplateListWrite(templateId, template) {
        try {
          // sync `/propertyTemplatesList`
          const upsertUpdates = await propertyTemplates.upsert(
            db,
            templateId,
            template
          );
          Object.assign(updates, upsertUpdates);
        } catch (err) {
          log.error(`${PREFIX} ${topic} | ${err}`);
        }
      }
    );

    // Remove templates disassociated with property
    await adminUtils.forEachChild(
      db,
      '/properties',
      async function removeOrphanedPropertyTemplates(propertyId, property) {
        try {
          const currentTemplateIds = Object.keys(
            (property || {}).templates || {}
          );
          const previousTemplateListIds = await adminUtils.fetchRecordIds(
            db,
            `/propertyTemplatesList/${propertyId}`
          );
          const removedTemplateIds = []
            .concat(previousTemplateListIds)
            .filter((tmplId, i, arr) => arr.indexOf(tmplId) === i) // Unique only
            .filter(tmplId => currentTemplateIds.indexOf(tmplId) === -1); // Proxy does not associated to property

          for (let i = 0; i < removedTemplateIds.length; i++) {
            const templateId = removedTemplateIds[i];
            await propertyTemplates.remove(db, templateId);
            updates[templateId] = true;
          }
        } catch (err) {
          log.error(
            `${PREFIX} ${topic} property templates sync failed | ${err}`
          );
        }
      }
    );

    return updates;
  });
};
