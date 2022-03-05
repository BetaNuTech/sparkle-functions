const assert = require('assert');
const templatesModel = require('./templates');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: template-categories:';
const TEMPLATE_CATEGORIES_COLLECTION = 'templateCategories';

module.exports = modelSetup({
  /**
   * Lookup Firestore Template Category
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  findRecord(db, categoryId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    return db
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId)
      .get();
  },

  /**
   * Create or update a Firestore template category
   * @param  {firebaseAdmin.firestore} db
   * @param  {String}  categoryId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(db, categoryId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    assert(data && typeof data === 'object', 'has upsert data');

    const colRef = db
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId);
    let docSnap = null;

    try {
      docSnap = await colRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
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
        `${PREFIX} upsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return colRef;
  },

  /**
   * Create a firestore document id
   * @param  {admin.firestore} db
   * @return {String}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(TEMPLATE_CATEGORIES_COLLECTION).doc().id;
  },

  /**
   * Create a Firestore template category
   * @param  {firebaseAdmin.firestore} db
   * @param  {String} categoryId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, categoryId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId)
      .create(data);
  },

  /**
   * Remove Firestore Template Category
   * TODO: replace with delete record
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  async removeRecord(db, categoryId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');

    const batch = db.batch();

    // Delete category from all templates
    try {
      await templatesModel.removeCategory(db, categoryId, batch);
    } catch (err) {
      throw Error(`${PREFIX}: ${err}`); // wrap
    }

    // Delete Template Category
    const docRef = db
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(categoryId);
    batch.delete(docRef);

    return batch.commit();
  },

  /**
   * Remove template category
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} templateCategoryId
   * @param  {firestore.batch?} batch
   * @return {Promise<void>}
   */
  deleteRecord(db, templateCategoryId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      templateCategoryId && typeof templateCategoryId === 'string',
      'has team id'
    );

    const doc = db
      .collection(TEMPLATE_CATEGORIES_COLLECTION)
      .doc(templateCategoryId);

    if (batch) {
      assert(typeof batch.delete === 'function', 'has batch instance');
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Query all template categories
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let dbQuery = db.collection(TEMPLATE_CATEGORIES_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      dbQuery = dbQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return Promise.resolve(transaction.get(dbQuery));
    }

    return dbQuery.get(query);
  },
});
