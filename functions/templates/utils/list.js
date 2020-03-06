const assert = require('assert');
const log = require('../../utils/logger');
const adminUtils = require('../../utils/firebase-admin');

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
  write(db, fs, templateId, before, after) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(Boolean(fs), 'has firestore DB instance');
    assert(templateId && typeof templateId === 'string', 'has template ID');
    assert(typeof before === 'object', 'has before object');
    assert(typeof after === 'object', 'has after object');
    const target = `/templatesList/${templateId}`;

    // Template removed
    if (!after) {
      log.info(`${PREFIX} write: removing ${target}`);

      return db
        .ref(target)
        .remove()
        .catch(e =>
          Promise.reject(
            Error(`${PREFIX} write: failed to remove at ${target} ${e}`) // wrap error
          )
        )
        .then(() => null);

      // TODO remove Firestore record
    }

    if (!after.name) {
      return Promise.reject(
        Error(`${PREFIX} write: required template name missing`)
      );
    }

    // Template added or updated
    const upsertData = {};

    // Required attributes
    upsertData.name = after.name;
    upsertData.category = after.category || null;

    // Optional attributes
    if (after.description) upsertData.description = after.description;

    return db
      .ref(target)
      .update(upsertData)
      .catch(e =>
        Promise.reject(
          Error(
            `${PREFIX} write: failed to ${
              before ? 'update' : 'add'
            } record at ${target} ${e}`
          ) // wrap error
        )
      )
      .then(() => upsertData);

    // TODO upstert Firestore record
  },

  /**
   * Remove category attribute for all template list
   * proxies and Firestore templates with a given category ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves (Object) hash of updates
   */
  async removeCategory(db, fs, categoryId) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(Boolean(fs), 'has firestore DB instance');
    assert(categoryId && typeof categoryId === 'string', 'has category ID');

    const updates = {};

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
        log.info(`${PREFIX} remove-category: ${target}`);
      });

      // Update database
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }
    } catch (err) {
      // wrap error
      throw Error(
        `${PREFIX} remove-category: ${categoryId} from /templatesList failed | ${err}`
      );
    }

    // TODO Remove Firestore associations

    return updates;
  },

  /**
   * Remove templatesList proxies and Firestore records
   * that do not have an existing source template record
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String[]} existingTemplateIds
   * @param  {utils}    adminUtils
   * @return {Promise} - resolves {Object} updates hash
   */
  async removeOrphans(db, fs, existingTemplateIds = [], utils = adminUtils) {
    assert(Boolean(db), 'has realtime DB instance');
    assert(Boolean(fs), 'has firestore DB instance');
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

    // TODO remove Firestore records

    return updates;
  },
};
