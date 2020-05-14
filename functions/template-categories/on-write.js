const assert = require('assert');
const log = require('../utils/logger');
const templateCategories = require('../models/template-categories');

const PREFIX = 'template-categories: on-write:';

/**
 * Factory for template category on write handler
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onWrite handler
 */
module.exports = function templateCategoryOnWrite(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { categoryId } = event.params;

    if (!categoryId) {
      log.warn(`${PREFIX} incorrectly defined event parameter "categoryId"`);
      return;
    }

    const updating = change.before.exists();
    const afterData = change.after.val();

    // Do nothing on delete
    if (!afterData) return;

    // Create or update firestore record
    try {
      await templateCategories.firestoreUpsertRecord(fs, categoryId, afterData);
    } catch (err) {
      log.error(
        `${PREFIX} failed to ${
          updating ? 'update' : 'create'
        } firestore template category "${categoryId}" | ${err}`
      );
      throw err;
    }
  };
};
