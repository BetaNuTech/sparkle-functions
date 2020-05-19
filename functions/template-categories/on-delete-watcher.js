const assert = require('assert');
const log = require('../utils/logger');
const templatesList = require('../templates/utils/list');
const templatesModel = require('../models/templates');
const templateCategories = require('../models/template-categories');
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
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

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

    // Lookup associated templates
    let templatesInCategory = null;
    try {
      templatesInCategory = await templatesModel.realtimeQueryByCategory(
        db,
        categoryId
      );
    } catch (err) {
      log.error(
        `${PREFIX} realtime template lookup by category failed | ${err}`
      );
    }

    // Remove Firestore template category
    try {
      await templateCategories.firestoreRemoveRecord(fs, categoryId);
    } catch (err) {
      log.error(
        `${PREFIX} Failed to remove firestore template category | ${err}`
      );
    }

    // Category has no associated templates
    if (!templatesInCategory.exists()) {
      log.info(`${PREFIX} has no associated templates, exiting`);
      return;
    }

    // Create update hash for all
    // associated templates
    const updates = {};
    const templateIds = Object.keys(templatesInCategory.val());
    templateIds.forEach(tempId => {
      updates[`/${tempId}/category`] = null;
    });

    try {
      // Write all template updates to database
      await templatesModel.realtimeBatchUpdate(db, updates);

      // Remove each template's proxy record `category`
      for (let i = 0; i < templateIds.length; i++) {
        await propertyTemplates.remove(db, templateIds[i], '/category');
      }
    } catch (err) {
      log.error(
        `${PREFIX} Failed to disassociate realtime template relationship | ${err}`
      );
      return;
    }

    // Remove Realtime DB associations in /templatesList
    // TODO: move to fs remove record: Remove Firestore DB associations in /templates
    try {
      await templatesList.removeCategory(db, fs, categoryId);
    } catch (err) {
      log.error(`${PREFIX} Failed to update template proxies | ${err}`);
    }
  };
};
