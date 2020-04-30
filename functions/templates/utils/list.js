const assert = require('assert');
const adminUtils = require('../../utils/firebase-admin');
const templatesModel = require('../../models/templates');

const PREFIX = 'templates: utils: list:';

module.exports = {
  /**
   * Handle adds, deletes, & updates to
   * templatesList proxies and Firestore records
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} templateId
   * @param  {Object} before - record POJO
   * @param  {Object} after - record POJO
   * @return {Promise} - resolves {Object} write result (template or null)
   */
  async write(db, fs, templateId, before, after) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(Boolean(fs), 'has firestore DB instance');
    assert(templateId && typeof templateId === 'string', 'has template ID');
    assert(typeof before === 'object', 'has before object');
    assert(typeof after === 'object', 'has after object');

    // Template removed
    if (!after) {
      try {
        await templatesModel.realtimeRemoveListRecord(db, templateId);
      } catch (err) {
        throw Error(`${PREFIX} write: ${err}`);
      }

      try {
        await templatesModel.firestoreRemoveRecord(fs, templateId);
      } catch (err) {
        throw Error(`${PREFIX} write: ${err}`);
      }

      return null;
    }

    if (!after.name) {
      throw Error(`${PREFIX} write: required template name missing`);
    }

    // Template added or updated
    const upsertData = {};
    const isUpdate = Boolean(before);

    // Required attributes
    upsertData.name = after.name;
    upsertData.category = after.category || null;

    // Optional attributes
    if (after.description) upsertData.description = after.description;

    try {
      await templatesModel.realtimeUpsertListRecord(db, templateId, upsertData);
    } catch (err) {
      throw Error(
        `${PREFIX} write: failed template list ${
          isUpdate ? 'update' : 'create'
        }: ${err}`
      );
    }

    try {
      // Copy new template data
      const fsUpsertData = { ...after };

      // Ensure category removed if not found
      if (before && after) {
        if (before.category && !after.category) {
          fsUpsertData.category = null;
        }

        if (before.description && !after.description) {
          fsUpsertData.description = null;
        }
      }

      await templatesModel.firestoreUpsertRecord(fs, templateId, fsUpsertData);
    } catch (err) {
      throw Error(
        `${PREFIX} write: failed firestore upsert ${
          isUpdate ? 'update' : 'create'
        }: ${err}`
      );
    }

    return upsertData;
  },

  /**
   * Remove category attribute for all template list
   * proxies and Firestore templates with a given category ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves (Object) hash of realtime DB updates
   */
  async removeCategory(db, fs, categoryId) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(Boolean(fs), 'has firestore DB instance');
    assert(categoryId && typeof categoryId === 'string', 'has category ID');

    const realtimeUpdates = {};

    try {
      const templatesListItemsInCategory = await templatesModel.realtimeQueryListByCategory(
        db,
        categoryId
      );

      // Collect all updates to associated /templatesList records
      Object.keys(templatesListItemsInCategory.val() || {}).forEach(id => {
        realtimeUpdates[`${id}/category`] = null;
      });

      // Update database
      await templatesModel.realtimeBatchUpdateList(db, realtimeUpdates);
    } catch (err) {
      // wrap error
      throw Error(
        `${PREFIX} removeCategory: "${categoryId}" realtime update failed | ${err}`
      );
    }

    try {
      const firestoreUpdates = {};
      const templatesInCategorySnap = await templatesModel.firestoreQueryByCategory(
        fs,
        categoryId
      );

      // Add all category removals to updates
      templatesInCategorySnap.docs.forEach(templateSnap => {
        firestoreUpdates[templateSnap.id] = { category: null };
      });

      await templatesModel.firestoreBatchUpdate(fs, firestoreUpdates);
    } catch (err) {
      throw Error(
        `${PREFIX} removeCategory: "${categoryId}" firestore update failed | ${err}`
      );
    }

    return realtimeUpdates;
  },

  /**
   * Remove templatesList proxies that do not
   * have an existing source template record
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String[]} existingTemplateIds
   * @param  {utils}    adminUtils
   * @return {Promise} - resolves {Object} updates hash
   */
  async removeOrphans(db, existingTemplateIds = [], utils = adminUtils) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(
      Array.isArray(existingTemplateIds) &&
        existingTemplateIds.every(id => id && typeof id === 'string'),
      'has existing templates ids array'
    );

    const updates = {};

    try {
      const templatesListIds = await utils.fetchRecordIds(db, '/templatesList');

      templatesListIds
        .filter(id => existingTemplateIds.indexOf(id) === -1)
        .forEach(id => {
          // Collect updates
          updates[`/templatesList/${id}`] = null;
        });

      // Update database
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }
    } catch (err) {
      // wrap error
      throw Error(`${PREFIX} remove-orphans: failed | ${err}`);
    }

    return updates;
  },
};
