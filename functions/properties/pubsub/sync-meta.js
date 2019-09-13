const log = require('../../utils/logger');
const { forEachChild } = require('../../utils/firebase-admin');
const processPropertyMeta = require('../utils/process-meta');

const PREFIX = 'properties: pubsub: sync-meta:';

/**
 * Sync meta data of all Properties from their
 * completed inspections
 * @param  {String} topic
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
      await forEachChild(
        db,
        '/properties',
        async function proccessPropertyMetaWrite(propertyId) {
          try {
            const propMetaUpdate = await processPropertyMeta(db, propertyId);
            Object.assign(updates, propMetaUpdate);
          } catch (err) {
            log.error(`${PREFIX} ${topic} | ${err}`);
          }
        }
      );

      return updates;
    });
};
