const list = require('../list');
const log = require('../../utils/logger');
const propertyTemplates = require('../../property-templates');
const adminUtils = require('../../utils/firebase-admin');

const LOG_PREFIX = 'templates: cron: sync-property-templates-list:';

/**
 * Sync templates with propertyTemplates and log
 * any orphaned records
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
*/
module.exports = function createSyncPropertyTemplatesListHandler(topic = '', pubSub, db) {
  return pubSub
  .topic(topic)
  .onPublish(async () => {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    // Add missing/outdated templatesList records
    await adminUtils.forEachChild(db, '/templates', async function propertyTemplateListWrite(templateId, template) {
      try {
         // sync `/propertyTemplates` & `/propertyTemplatesList`
        const upsertUpdates = await propertyTemplates.upsert(db, templateId, template);
        Object.assign(updates, upsertUpdates);
      } catch (e) {
        log.error(`${LOG_PREFIX} ${e}`);
      }
    });

    // Remove templates disassociated with property
    await adminUtils.forEachChild(db, '/properties', async function removeOrphanedPropertyTemplates(propertyId, property) {
      try {
        const currentTemplateIds = Object.keys((property || {}).templates || {});
        const previousTemplateIds = await adminUtils.fetchRecordIds(db, `/propertyTemplates/${propertyId}`);
        const previousTemplateListIds = await adminUtils.fetchRecordIds(db, `/propertyTemplatesList/${propertyId}`);
        const removedTemplateIds = [].concat(previousTemplateIds, previousTemplateListIds)
          .filter((tmplId, i, arr) => arr.indexOf(tmplId) === i) // Unique only
          .filter(tmplId => currentTemplateIds.indexOf(tmplId) === -1); // Proxy does not associated to property

        for (let i = 0; i < removedTemplateIds.length; i++) {
          const templateId = removedTemplateIds[i];
          await propertyTemplates.remove(db, templateId);
          updates[templateId] = true;
        }
      } catch (e) {
        log.error(`${LOG_PREFIX} property templates sync failed ${e}`);
      }
    });

    return updates;
  });
}
