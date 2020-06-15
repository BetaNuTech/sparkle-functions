const assert = require('assert');
const log = require('../../utils/logger');
const { forEachChild } = require('../../utils/firebase-admin');
const propertiesModel = require('../../models/properties');
const processPropertyMeta = require('../utils/process-meta');

const PREFIX = 'properties: pubsub: sync-meta:';

/**
 * Sync meta data of all Properties from their
 * completed inspections
 * @param  {String} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {functions.cloudfunction}
 */
module.exports = function createSyncPropertiesMetahandler(
  topic = '',
  pubsub,
  db,
  fs
) {
  assert(Boolean(pubsub), 'has pubsub client');
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');

  return pubsub
    .topic(topic)
    .onPublish(async function syncPropertiesMetaHandler() {
      await forEachChild(
        db,
        '/properties',
        async function proccessPropertyMetaWrite(propertyId) {
          try {
            await propertiesModel.updateMetaData(fs, propertyId);
          } catch (err) {
            log.error(
              `${PREFIX} ${topic} firestore property "${propertyId}" update failed | ${err}`
            );
          }
          try {
            await processPropertyMeta(db, propertyId);
          } catch (err) {
            log.error(
              `${PREFIX} ${topic} realtime property "${propertyId}" update failed | ${err}`
            );
          }
        }
      );
    });
};
