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

      const updates = {};
      const snapShot = yield db.ref('/templates').once('value');

      // No templates in database
      if (!snapShot.exists()) {
        return updates;
      }

      // Collect all template ID's
      const templateIds = (
        snapShot.hasChildren() ? Object.keys(snapShot.toJSON()) : [snapShot.key]
      ).filter(Boolean); // ignore null's
    }));
  }
};
