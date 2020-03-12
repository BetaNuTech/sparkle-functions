const assert = require('assert');
const log = require('../utils/logger');
const templatesList = require('../templates/utils/list');
const templatesModel = require('../models/templates');
const propertyTemplates = require('../property-templates');

const PREFIX = 'template-categories: on-delete:';

/**
 * Factory for the template category
 * on delete handler
 *
 * Disassociates any Templates connected to deleted
 * Template Category record
 *
 * @param  {firebaseAdmin.database} db - Allow interface for tests
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {function}
 */
module.exports = function createOnDeleteHandler(db, fs) {
  assert(Boolean(db), 'has realtime DB reference');
  assert(Boolean(fs), 'has firestore DB reference');

  /**
   * Handler for the deletion of a Template Category
   * @param {functions.database.DataSnapshot} templateCategorySnapshot
   * @return {Promise}
   */
  return async (templateCategorySnapshot, context) => {
    const updates = {};
    const { categoryId } = context.params;

    if (!categoryId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "categoryId"`);
      return;
    }

    log.info(`${PREFIX} category ID: ${categoryId}`);

    // Lookup associated templates
    const templatesInCategory = await templatesModel.realtimeQueryByCategory(
      db,
      categoryId
    );

    // Category has no associated templates
    if (!templatesInCategory.exists()) {
      log.info(`${PREFIX} has no associated templates, exiting`);
      return;
    }

    // Create update hash for all
    // associated templates
    const templateIds = Object.keys(templatesInCategory.val());
    templateIds.forEach(tempId => {
      updates[`/${tempId}/category`] = null;
    });

    try {
      // Write all template updates to database
      await templatesModel.realtimeBatchUpdate(db, updates);

      // Remove each template's proxy record `category`
      for (let i = 0; i < templateIds.length; i++) {
        // updates[`/propertyTemplatesList/**/${templateIds[i]}/category`] =
        //   'removed';
        await propertyTemplates.remove(db, templateIds[i], '/category');
      }
    } catch (err) {
      log.error(
        `${PREFIX} Failed to disassociate template relationship | ${err}`
      );
    }

    // Remove Realtime DB associations in /templatesList
    // Remove Firestore DB associations in /templates
    try {
      await templatesList.removeCategory(db, fs, categoryId);
    } catch (e) {
      log.error(e);
    }

    // return updates;
  };
};
