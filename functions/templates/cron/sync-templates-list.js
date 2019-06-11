const list = require('../list');
const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

const LOG_PREFIX = 'templates: cron: sync-templates-list:';

/**
 * Sync templates with propertyTemplates and log
 * any orphaned records
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncTemplatesListHandler(
  topic = '',
  pubSub,
  db
) {
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};
    log.info(`${LOG_PREFIX} received ${Date.now()}`);

    try {
      // Collect all template ID's
      const templateIds = await adminUtils.fetchRecordIds(db, '/templates');

      // Cleanup templatesList items without a source template
      await list.removeOrphans(db, templateIds);
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
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
          log.error(`${LOG_PREFIX} ${e}`);
        }
      }
    );

    return updates;
  });
};
