const co = require('co');
const log = require('../utils/logger');

const LOG_PREFIX = 'inspections:';

module.exports = {
 /**
  * Sync templates with propertyTemplates and log
  * any orphaned records
  * @param  {String} topic
  * @param  {functions.pubsub} pubSub
  * @param  {firebaseAdmin.database} db
  * @return {functions.CloudFunction}
  */
  createPublishHandler(topic = '', pubSub, db) {
    const logPrefix = `${LOG_PREFIX} onPublish: ${topic}:`;

    return pubSub
    .topic(topic)
    .onPublish(() => co(function *() {
      const updates = {};
      log.info(`${logPrefix} received ${Date.now()}`);
      return updates;
    }));
  }
};
