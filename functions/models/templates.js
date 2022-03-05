const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: templates:';
const TEMPLATE_COLLECTION = 'templates';
const { isArray } = Array;

module.exports = modelSetup({
  /**
   * Lookup Firestore Template
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} templateId
   * @return {Promise}
   */
  findRecord(db, templateId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(templateId && typeof templateId === 'string', 'has template id');
    return db
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .get();
  },

  /**
   * Remove Firestore Template
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} templateId
   * @return {Promise}
   */
  removeRecord(db, templateId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(templateId && typeof templateId === 'string', 'has template id');
    return db
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .delete();
  },

  /**
   * Update/add Firestore Template
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} templateId
   * @param  {Object} data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(db, templateId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(templateId && typeof templateId === 'string', 'has template id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = db.collection(TEMPLATE_COLLECTION).doc(templateId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;
    const upsert = { ...data };

    try {
      if (exists) {
        // Replace optional field nulls
        // with Firestore delete values
        if (upsert.category === null) {
          upsert.category = FieldValue.delete();
        }
        if (upsert.description === null) {
          upsert.description = FieldValue.delete();
        }

        await docRef.update(upsert);
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.category) delete upsert.category;
        if (!upsert.description) delete upsert.description;
        await docRef.create(upsert);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} upsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Create a firestore document id
   * @param  {admin.firestore} db
   * @return {String}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(TEMPLATE_COLLECTION).doc().id;
  },

  /**
   * Create a Firestore template
   * @param  {admin.firestore} db
   * @param  {String} templateId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, templateId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(templateId && typeof templateId === 'string', 'has template id');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .create(data);
  },

  /**
   * Lookup all templates associated with a category
   * TODO: replace with query method
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} categoryId
   * @return {Promise} - resolves {QuerySnapshot}
   */
  queryByCategory(db, categoryId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    return db
      .collection(TEMPLATE_COLLECTION)
      .where('category', '==', categoryId)
      .get();
  },

  /**
   * Query all templates
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let dbQuery = db.collection(TEMPLATE_COLLECTION);

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

  /**
   * Batch update templates
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {Object} updates - { id: { name: "update" } }
   * @return {Promise}
   */
  batchUpdate(db, updates) {
    const batch = db.batch();
    const templatesRef = db.collection(TEMPLATE_COLLECTION);

    if (!updates || !Object.keys(updates).length) {
      return Promise.resolve();
    }

    // Apply each templates' update to batch
    Object.keys(updates).forEach(id => {
      const update = updates[id];
      assert(typeof update === 'object', `has update hash for "${id}"`);
      const templateDoc = templatesRef.doc(id);
      batch.update(templateDoc, update);
    });

    return batch.commit();
  },

  /**
   * Lookup all template documents snapshots
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  findAll(db) {
    return db
      .collection(TEMPLATE_COLLECTION)
      .get()
      .then(collectionSnap => {
        const result = [];

        collectionSnap.docs.forEach(docSnap => {
          result.push(docSnap);
        });

        return result;
      });
  },

  /**
   * Perform a batch updates on
   * Firestore templates properties
   * relationships. Removes old and
   * adds new property relationships
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {String[]} beforeTemplates
   * @param  {String[]} afterTemplates
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  updatePropertyRelationships(
    db,
    propertyId,
    beforeTemplates,
    afterTemplates,
    parentBatch
  ) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      isArray(beforeTemplates) &&
        beforeTemplates.every(t => t && typeof t === 'string'),
      'has before templates id list'
    );
    assert(
      isArray(afterTemplates) &&
        afterTemplates.every(t => t && typeof t === 'string'),
      'has after templates id list'
    );

    const added = afterTemplates.filter(t => !beforeTemplates.includes(t));
    const removed = beforeTemplates.filter(t => !afterTemplates.includes(t));
    const batch = parentBatch || db.batch();

    const templatesRef = db.collection(TEMPLATE_COLLECTION);

    // Append each new relationship
    // add to batch
    added.forEach(id => {
      const templateDoc = templatesRef.doc(id);
      batch.update(templateDoc, {
        properties: FieldValue.arrayUnion(propertyId),
      });
    });

    // Append each old relationship
    // remove to batch
    removed.forEach(id => {
      const templateDoc = templatesRef.doc(id);
      batch.update(templateDoc, {
        properties: FieldValue.arrayRemove(propertyId),
      });
    });

    // Return without committing
    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Remove a category from
   * all associated templates
   * @param  {admin.firestore} db - Firestore Admin DB instance
   * @param  {String} categoryId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  removeCategory(db, categoryId, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    return db
      .runTransaction(async transaction => {
        const transOrBatch = batch || transaction;
        const templateQuery = db
          .collection(TEMPLATE_COLLECTION)
          .where('category', '==', categoryId);

        let templatesSnap = null;
        try {
          templatesSnap = await transaction.get(templateQuery);
        } catch (err) {
          throw Error(
            `${PREFIX} removeCategory: template lookup failed: ${err}`
          );
        }

        // Remove category from each associated template
        templatesSnap.docs.forEach(templateDoc => {
          transOrBatch.update(templateDoc.ref, {
            category: FieldValue.delete(),
          });
        });

        return transOrBatch;
      })
      .catch(err => {
        throw Error(`${PREFIX} removeCategory: transaction failed: ${err}`);
      });
  },

  /**
   * Batch remove all firestore template
   * relationships to a deleted category
   * @param  {admin.firestore} db
   * @param  {String[]} templateIds
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  batchRemoveCategory(db, templateIds, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      templateIds && Array.isArray(templateIds),
      'has template ids as an array'
    );
    assert(
      templateIds.every(id => id && typeof id === 'string'),
      'template ids is an array of strings'
    );
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has firestore batch/transaction'
      );
    }

    const batch = parentBatch || db.batch();
    const collection = db.collection(TEMPLATE_COLLECTION);

    // Remove each templates' category
    templateIds.forEach(id => {
      const propertyDoc = collection.doc(id);
      batch.update(propertyDoc, { category: FieldValue.delete() });
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },
});
