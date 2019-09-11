const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const list = require('../utils/list');

const PREFIX = 'templates: cron: sync-templates-list:';

/**
 * Sync templates with propertyTemplatesList and log
 * any orphaned records
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncTemplatesListSubscriber(
  topic = '',
  pubSub,
  db
) {
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};
    log.info(`${PREFIX} received ${Date.now()}`);

    try {
      // Collect all template ID's
      const templateIds = await adminUtils.fetchRecordIds(db, '/templates');

      // Cleanup templatesList items without a source template
      await list.removeOrphans(db, templateIds);
    } catch (e) {
      log.error(`${PREFIX} ${e}`);
    }

    // Add missing/outdated templatesList records
    await adminUtils.forEachChild(
      db,
      '/templates',
      async function templateListWrite(templateId, template) {
        try {
          const result = await list.write(db, templateId, template, template);
          updates[templateId] = result ? 'upserted' : 'removed';
        } catch (e) {
          log.error(`${PREFIX} ${e}`);
        }
      }
    );

    return updates;
  });
};
