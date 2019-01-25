const co = require('co');

const LOG_PREFIX = 'templates:';

module.exports = {
 /**
  * Sync /propertyTemplates with templates and log
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
      log.info(`${logPrefix} received ${Date.now()}`);
    }));
  }
};
