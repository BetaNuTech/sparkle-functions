const assert = require('assert');
const log = require('../utils/logger');
const templatesList = require('../templates/list');
const propertyTemplates = require('../property-templates');

const PREFIX = 'template-categories: on-delete:';

/**
 * Factory for the template category
 * on delete handler
 *
 * Disassociates any Templates connected to deleted
 * Template Category record
 *
 * @param  {firebaseAdmin.database} - Allow interface for tests
 * @return {function}
 */
module.exports = function createOnDeleteHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  /**
   * Handler for the deletion of a Template Category
   *
   *
   * @param {functions.database.DataSnapshot} templateCategorySnapshot
   * @return {Promise}
   */
  return async (templateCategorySnapshot, context) => {
    const updates = Object.create(null);
    const { categoryId } = context.params;

    if (!categoryId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "categoryId"`);
      return;
    }

    log.info(`${PREFIX} category ID: ${categoryId}`);

    // Lookup associated templates
    const templatesInCategory = await db
      .ref('/templates')
      .orderByChild('category')
      .equalTo(categoryId)
      .once('value');

    // Category has no associated templates
    if (!templatesInCategory.exists()) {
      log.info(`${PREFIX} has no associated templates, exiting`);
      return;
    }

    // Create update hash for all
    // associated templates
    const templateIds = Object.keys(templatesInCategory.val());
    templateIds.forEach(tempId => {
      updates[`/templates/${tempId}/category`] = null;
      log.info(`${PREFIX} disassociating template: ${tempId}`);
    });

    try {
      // Write all template updates to database
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }

      // Remove each template's proxy record `category`
      for (let i = 0; i < templateIds.length; i++) {
        updates[`/propertyTemplatesList/**/${templateIds[i]}/category`] =
          'removed';
        await propertyTemplates.remove(db, templateIds[i], '/category');
      }
    } catch (e) {
      log.error(
        `${PREFIX} Failed to disassociate template relationship | ${e}`
      );
    }

    // Remove associations in /templatesList
    try {
      await templatesList.removeCategory(db, categoryId);
    } catch (e) {
      log.error(e);
    }

    return updates;
  };
};
