const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: templates:';
const LIST_DB = '/templatesList';
const TEMPLATES_DB = '/templates';
const TEMPLATE_COLLECTION = 'templates';
const { isArray } = Array;

module.exports = modelSetup({
  /**
   * Lookup Template
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} templateId
   * @return {Promise}
   */
  realtimeFindRecord(db, templateId) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    return db.ref(`${TEMPLATES_DB}/${templateId}`).once('value');
  },

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
   * Add/update Template
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} templateId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, templateId, data) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${TEMPLATES_DB}/${templateId}`).update(data);
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
   * Lookup all templates
   * associated with a category
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} categoryId
   * @return {Promise}
   */
  realtimeQueryByCategory(db, categoryId) {
    assert(
      categoryId && typeof categoryId === 'string',
      `${PREFIX} has category id`
    );
    return db
      .ref(TEMPLATES_DB)
      .orderByChild('category')
      .equalTo(categoryId)
      .once('value');
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
   * Bulk update template
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {Object} updates
   * @return {Promise}
   */
  realtimeBatchUpdate(db, updates) {
    assert(typeof updates === 'object', 'has updates hash');

    if (!updates || !Object.keys(updates).length) {
      return Promise.resolve();
    }

    return db.ref(TEMPLATES_DB).update(updates);
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
   * Lookup Firestore Template
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} templateId
   * @return {Promise}
   */
  firestoreFindRecord(fs, templateId) {
    assert(
      templateId && typeof templateId === 'string',
      `${PREFIX} has template id`
    );
    return fs
      .collection(TEMPLATE_COLLECTION)
      .doc(templateId)
      .get();
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
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, templateId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(templateId && typeof templateId === 'string', 'has template id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(TEMPLATE_COLLECTION).doc(templateId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
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
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
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
   * @param  {admin.firestore} fs - Firestore DB instance
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
    Object.keys(updates).forEach(id => {
      const update = updates[id];
      assert(typeof update === 'object', `has update hash for "${id}"`);
      const templateDoc = templatesRef.doc(id);
      batch.update(templateDoc, update);
    });

    return batch.commit();
  },

  /**
   * Remove a category from all firestore templates
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} categoryId
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {firestore.batch}
   */
  async firestoreRemoveCategory(fs, categoryId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(categoryId && typeof categoryId === 'string', 'has category id');

    const catBatch = batch || fs.batch();
    const col = fs.collection(TEMPLATE_COLLECTION);

    try {
      const templatesInCategorySnap = await this.firestoreQueryByCategory(
        fs,
        categoryId
      );

      // Add all category removals to updates
      templatesInCategorySnap.docs.forEach(templateSnap => {
        const docRef = col.doc(templateSnap.id);
        catBatch.update(docRef, { category: null });
      });
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreRemoveCategory: "${categoryId}" firestore update failed: ${err}`
      );
    }

    // Return included batch updates
    if (batch) {
      return batch;
    }

    // Commit created batch updates
    return catBatch.commit();
  },

  /**
   * Lookup all template documents snapshots
   * @param  {firebaseAdmin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreFindAll(fs) {
    return fs
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
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} propertyId
   * @param  {String[]} beforeTemplates
   * @param  {String[]} afterTemplates
   * @return {Promise}
   */
  updatePropertyRelationships(fs, propertyId, beforeTemplates, afterTemplates) {
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

    const batch = fs.batch();
    const templatesRef = fs.collection(TEMPLATE_COLLECTION);

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

    return batch.commit();
  },
});
