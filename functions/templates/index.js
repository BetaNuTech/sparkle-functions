const co = require('co');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'templates:';

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

      var id, i;

      // Sync existing templates w/ /propertyTemplates
      for (i = 0; i < templateIds.length; i++) {
        id = templateIds[i];

        try {
          const templateSnap = yield db.ref(`/templates/${id}`).once('value');
          yield propertyTemplates.update(db, id, templateSnap.val());
          updates[id] = true;
        } catch (e) {
          log.error(`${logPrefix} update failed`, e);
        }
      }

      return updates;
    }));
  }
};
