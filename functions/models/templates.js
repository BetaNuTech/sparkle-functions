const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: templates:';
const LIST_DB = '/templatesList';
const TEMPLATE_COLLECTION = 'templates';

module.exports = modelSetup({
  /**
   * Remove Template List proxy
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} templateId
   * @return {Promise}
   */
  realtimeRemoveListRecord(db, templateId) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    return db.ref(`${LIST_DB}/${templateId}`).remove();
  },

  /**
   * Add/update Template List proxy
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} templateId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertListRecord(db, templateId, data) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${LIST_DB}/${templateId}`).update(data);
  },

  /**
   * Lookup all template lists
   * associated with a category
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  realtimeQueryListByCategory(db, categoryId) {
    assert(
      categoryId && typeof categoryId === 'string',
      `${PREFIX} has category id`
    );
    return db
      .ref(LIST_DB)
      .orderByChild('category')
      .equalTo(categoryId)
      .once('value');
  },

  /**
   * Bulk update template list
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {Object} updates
   * @return {Promise}
   */
  realtimeBatchUpdateList(db, updates) {
    assert(typeof updates === 'object', 'has updates hash');

    if (!updates || !Object.keys(updates).length) {
      return Promise.resolve();
    }

    return db.ref(LIST_DB).update(updates);
  },

  /**
   * Remove Firestore Template
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} templateId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, templateId) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    return fs
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .delete();
  },

  /**
   * Update/add Firestore Template
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} templateId
   * @param  {Object} data
   * @return {Promise}
   */
  firestoreUpsertRecord(fs, templateId, data) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return fs
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .update(data);
  },

  /**
   * Lookup all templates associated with a category
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves {QuerySnapshot}
   */
  firestoreQueryByCategory(fs, categoryId) {
    assert(
      categoryId && typeof categoryId === 'string',
      `${PREFIX} has category id`
    );
    return fs
      .collection(TEMPLATE_COLLECTION)
      .where('category', '==', categoryId)
      .get();
  },

  /**
   * Batch update templates
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {Object} updates - { id: { name: "update" } }
   * @return {Promise}
   */
  firestoreBatchUpdate(fs, updates) {
    const batch = fs.batch();
    const templatesRef = fs.collection(TEMPLATE_COLLECTION);

    if (!updates || !Object.keys(updates).length) {
      return Promise.resolve();
    }

    // Apply each templates' update to batch
    Object.key(updates).forEach(id => {
      const update = updates[id];
      assert(typeof update === 'object', `has update hash for "${id}"`);
      const templateDoc = templatesRef.doc(id);
      batch.update(templateDoc, update);
    });

    return batch.commit();
  },
});
