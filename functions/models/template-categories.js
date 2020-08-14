const assert = require('assert');
const templatesModel = require('./templates');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: template-categories:';
const TEMPLATE_CATEGORIES_COLLECTION = 'templateCategories';

module.exports = modelSetup({
  /**
   * Lookup Firestore Template Category
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  firestoreFindRecord(fs, categoryId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    return fs
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId)
      .get();
  },

  /**
   * Create or update a Firestore template category
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  categoryId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, categoryId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    assert(data && typeof data === 'object', 'has upsert data');

    const colRef = fs
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId);
    let docSnap = null;

    try {
      docSnap = await colRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
    }

    const { exists } = docSnap;
    const upsert = { ...data };

    try {
      if (exists) {
        await colRef.update(upsert, { merge: true });
      } else {
        await colRef.create(upsert);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return colRef;
  },

  /**
   * Create a Firestore template category
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} categoryId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, categoryId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId)
      .create(data);
  },

  /**
   * Remove Firestore Template Category
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  async firestoreRemoveRecord(fs, categoryId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');

    const batch = fs.batch();

    // Delete category from all templates
    try {
      await templatesModel.firestoreRemoveCategory(fs, categoryId, batch);
    } catch (err) {
      throw Error(`${PREFIX}: ${err}`); // wrap
    }

    // Delete Template Category
    const docRef = fs
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId);
    batch.delete(docRef);

    return batch.commit();
  },
});
