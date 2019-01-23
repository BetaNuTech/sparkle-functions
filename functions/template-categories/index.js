const co = require('co');
const log = require('../utils/logger');
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
     */
    return co.wrap(function *(templateCategorySnapshot, context) {
      const id = context.params.objectId;
      log.info(`${LOG_PREFIX} category ID: ${id}`);

      // Lookup associated templates
      const templatesInCategory = yield db
        .ref("/templates")
        .orderByChild("category")
        .equalTo(id)
        .once("value");

      // Category has no associated templates
      if (!templatesInCategory.exists()) {
        log.info(`${LOG_PREFIX} has no associated templates, exiting`);
        return;
      }

      // Create update hash for all
      // associated templates
      const bulkUpdates = {};
      const templateIds = Object.keys(templatesInCategory.val());
      templateIds.forEach(tempId => {
        // Add to bluk update
        bulkUpdates[`/templates/${tempId}/category`] = null;
        log.info(`${LOG_PREFIX} disassociating template: ${tempId}`);
      });

      try {
        // Write all template updates to database
        if (templateIds.length) yield db.ref().update(bulkUpdates);
      } catch (e) {
        log.error(
          `${LOG_PREFIX} Failed to disassociate template relationship`,
          e
        );
      }
    });
  }
};
