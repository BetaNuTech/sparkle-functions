const co = require('co');
const log = require('../utils/logger');
const propertyTemplates = require('../property-templates');
const adminUtils = require('../utils/firebase-admin');
const createOnWriteHandler = require('./on-write-handler');

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
      const updates = {};
      log.info(`${logPrefix} received ${Date.now()}`);

      // Collect all template ID's
      const templateIds = yield adminUtils.fetchRecordIds(db, '/templates');

      // No templates in database
      if (!templateIds.length) {
        return updates;
      }

      var id, i, k;

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

      const propertyIds = yield adminUtils.fetchRecordIds(db, '/properties');

      // Remove templates disassociated with property
      for (i = 0; i < propertyIds.length; i++) {
        id = propertyIds[i];

        try {
          const propertySnap = yield db.ref(`/properties/${id}`).once('value');
          const currentTemplateIds = Object.keys((propertySnap.val() || {}).templates || {});
          const previousTemplateIds = yield adminUtils.fetchRecordIds(db, `/propertyTemplates/${id}`);
          const removedTemplateIds = previousTemplateIds.filter(tmplId => currentTemplateIds.indexOf(tmplId) === -1);

          for (k = 0; i < removedTemplateIds.length; i++) {
            yield propertyTemplates.remove(db, removedTemplateIds[k]);
            updates[removedTemplateIds[k]] = true;
          }
        } catch (e) {
          log.error(`${logPrefix} property sync failed`, e);
        }
      }

      return updates;
    }));
  },

  createOnWriteHandler
};
