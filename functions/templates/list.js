const assert = require('assert');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');

const LOG_PREFIX = 'templates: list:';

module.exports = {
  /**
   * Handle adds, deletes, & updates to `/templatesList/*`
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} templateId
   * @param  {Object} before - record POJO
   * @param  {Object} after - record POJO
   * @return {Promise} - resolves {Object} write result (template or null)
   */
  write(db, templateId, before, after) {
    assert(templateId && typeof templateId === 'string', 'has template ID');
    assert(typeof before === 'object', 'has before object');
    assert(typeof after === 'object', 'has after object');
    const target = `/templatesList/${templateId}`;

    // Template removed
    if (!after) {
      log.info(`${LOG_PREFIX} removing ${target}`);

      return db
        .ref(target)
        .remove()
        .catch(e =>
          Promise.reject(
            new Error(`${LOG_PREFIX} failed to remove at ${target} ${e}`) // wrap error
          )
        )
        .then(() => null);
    }

    if (!after.name) {
      return Promise.reject(
        new Error(`${LOG_PREFIX} required template name missing`)
      );
    }

    // Template added or updated
    const upsertData = Object.create(null);

    // Required attributes
    upsertData.name = after.name;

    // Optional attributes
    if (after.description) upsertData.description = after.description;
    if (after.category) upsertData.category = after.category;

    return db
      .ref(target)
      .update(upsertData)
      .catch(e =>
        Promise.reject(
          new Error(
            `${LOG_PREFIX} failed to ${
              before ? 'update' : 'add'
            } record at ${target} ${e}`
          ) // wrap error
        )
      )
      .then(() => upsertData);
  },

  /**
   * Remove category attribute for all template list
   * items of a given category ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves (Object) hash of updates
   */
  async removeCategory(db, categoryId) {
    assert(categoryId && typeof categoryId === 'string', 'has category ID');

    const updates = Object.create(null);

    try {
      const templatesListItemsInCategory = await db
        .ref('/templatesList')
        .orderByChild('category')
        .equalTo(categoryId)
        .once('value');

      // Category has no associated /templatesList
      if (!templatesListItemsInCategory.exists()) {
        return updates;
      }

      // Collect all updates to associated /templatesList records
      Object.keys(templatesListItemsInCategory.val()).forEach(id => {
        const target = `/templatesList/${id}/category`;
        updates[target] = null;
        log.info(`${LOG_PREFIX} removing ${target}`);
      });

      // Update database
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }
    } catch (err) {
      // wrap error
      throw Error(
        `${LOG_PREFIX} removeCategory: ${categoryId} from /templatesList failed | ${err}`
      );
    }

    return updates;
  },

  /**
   * Remove templatesList items that do not have a
   * existing source template record
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String[]} existingTemplateIds
   * @param  {utils}    adminUtils
   * @return {Promise} - resolves {Object} updates hash
   */
  async removeOrphans(db, existingTemplateIds = [], utils = adminUtils) {
    assert(
      Array.isArray(existingTemplateIds) &&
        existingTemplateIds.every(id => id && typeof id === 'string'),
      'has existing templates ids array'
    );

    const updates = Object.create(null);

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
      throw Error(`${LOG_PREFIX} removeOrphans: ${err}`);
    }

    return updates;
  },
};
