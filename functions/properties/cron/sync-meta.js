const log = require('../../utils/logger');
const { forEachChild } = require('../../utils/firebase-admin');
const processPropertyMeta = require('../process-meta');

const LOG_PREFIX = 'properties: cron: sync-meta:';

/**
 * Sync meta data of all Properties from their
 * completed inspections
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncPropertiesMetahandler(
  topic = '',
  pubsub,
  db
) {
  return pubsub
    .topic(topic)
    .onPublish(async function syncPropertiesMetaHandler() {
      const updates = {};
      log.info(`${LOG_PREFIX} received ${Date.now()}`);

      await forEachChild(
        db,
        '/properties',
        async function proccessPropertyMetaWrite(propertyId) {
          try {
            const propMetaUpdate = await processPropertyMeta(db, propertyId);
            Object.assign(updates, propMetaUpdate);
          } catch (e) {
            log.error(`${LOG_PREFIX} ${e}`);
          }
        }
      );

      return updates;
    });
};
