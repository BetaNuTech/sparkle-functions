const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: template-categories:';
const TEMPLATE_CATEGORIES_DB = '/templateCategories';
const TEMPLATE_CATEGORIES_COLLECTION = 'templateCategories';

module.exports = modelSetup({
  /**
   * Find realtime template category record
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves {DataSnapshot} team snapshot
   */
  realtimeFindRecord(db, categoryId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    return db.ref(`${TEMPLATE_CATEGORIES_DB}/${categoryId}`).once('value');
  },

  /**
   * Add/update realtime template category
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} categoryId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, categoryId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    assert(data && typeof data === 'object', 'has upsert data');
    return db.ref(`${TEMPLATE_CATEGORIES_DB}/${categoryId}`).update(data);
  },

  /**
   * Remove template category
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, categoryId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    return db.ref(`${TEMPLATE_CATEGORIES_DB}/${categoryId}`).remove();
  },

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
});
