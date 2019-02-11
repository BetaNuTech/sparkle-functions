const co = require('co');
const log = require('../utils/logger');
const templatesList = require('../templates/list');
const propertyTemplates = require('../property-templates');

const LOG_PREFIX = 'template-categories: onDelete:';

module.exports = {
  /**
   * Factory for the template category
   * on delete handler
   * @param  {firebaseAdmin.database} - Allow interface for tests
   * @return {function}
   */
  onDeleteHandler(db) {
    /**
     * Handler for the deletion of a Template Category
     *
     * Disassociates any Templates connected to deleted
     * Template Category record
     *
     * @param {functions.database.DataSnapshot} templateCategorySnapshot
     * @return {Promise}
     */
    return co.wrap(function *(templateCategorySnapshot, context) {
      const id = context.params.objectId;
      log.info(`${LOG_PREFIX} category ID: ${id}`);

      // Lookup associated templates
      const templatesInCategory = yield db
        .ref('/templates')
        .orderByChild('category')
        .equalTo(id)
        .once('value');

      // Category has no associated templates
      if (!templatesInCategory.exists()) {
        log.info(`${LOG_PREFIX} has no associated templates, exiting`);
        return;
      }

      // Create update hash for all
      // associated templates
      const updates = {};
      const templateIds = Object.keys(templatesInCategory.val());
      templateIds.forEach(tempId => {
        updates[`/templates/${tempId}/category`] = null;
        log.info(`${LOG_PREFIX} disassociating template: ${tempId}`);
      });

      try {
        // Write all template updates to database
        if (Object.keys(updates).length) {
          yield db.ref().update(updates);
        }

        // Remove each template's proxy record `category`
        for (var i = 0; i < templateIds.length; i++) {
          updates[`/propertyTemplates/**/${templateIds[i]}/category`] = 'removed';
          updates[`/propertyTemplatesList/**/${templateIds[i]}/category`] = 'removed';
          yield propertyTemplates.remove(db, templateIds[i], '/category');
        }
      } catch (e) {
        log.error(
          `${LOG_PREFIX} Failed to disassociate template relationship`,
          e
        );
      }

      // Remove associations in /templatesList
      try {
        yield templatesList.removeCategory(db, id);
      } catch (e) {
        log.error(e);
      }

      return updates;
    });
  }
};
