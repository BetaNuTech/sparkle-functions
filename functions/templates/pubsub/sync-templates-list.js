const assert = require('assert');
const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');
const list = require('../utils/list');

const PREFIX = 'templates: pubsub: sync-templates-list:';

/**
 * Sync templates with propertyTemplatesList and log
 * any orphaned records
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db - Realtime DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
 * @return {functions.CloudFunction}
 */
module.exports = function createSyncTemplatesListSubscriber(
  topic = '',
  pubSub,
  db,
  fs
) {
  assert(topic && typeof topic === 'string', 'has topic string');
  assert(pubSub && typeof pubSub.topic === 'function', 'has pubsub instance');
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};

    try {
      // Collect all template ID's
      const templateIds = await adminUtils.fetchRecordIds(db, '/templates');

      // Cleanup templatesList items without a source template
      await list.removeOrphans(db, templateIds);
    } catch (err) {
      log.error(`${PREFIX} ${topic} | ${err}`);
    }

    // Add missing/outdated templatesList records
    await adminUtils.forEachChild(
      db,
      '/templates',
      async function templateListWrite(templateId, template) {
        try {
          const result = await list.write(
            db,
            fs,
            templateId,
            template,
            template
          );
          updates[templateId] = result ? 'upserted' : 'removed';
        } catch (err) {
          log.error(`${PREFIX} ${topic} | ${err}`);
        }
      }
    );

    return updates;
  });
};
