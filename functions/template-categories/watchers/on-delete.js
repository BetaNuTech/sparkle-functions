const assert = require('assert');
const log = require('../../utils/logger');
const templatesModel = require('../../models/templates');

const PREFIX = 'template-categories: on-delete-v2:';

/**
 * Factory for the template category
 * on delete handler
 *
 * Disassociates any Templates connected to deleted
 * Template Category record
 *
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @return {function}
 */
module.exports = function createOnDeleteHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handler for the deletion of a Template Category
   * @param {functions.database.DataSnapshot} templateCategorySnapshot
   * @return {Promise}
   */
  return async (templateCategorySnapshot, context) => {
    const { categoryId } = context.params;

    if (!categoryId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "categoryId"`);
      return;
    }

    // Remove Firestore template category
    try {
      await templatesModel.removeCategory(db, categoryId);
    } catch (err) {
      log.error(`${PREFIX} Failed to remove category from templates: ${err}`);
    }
  };
};
