const assert = require('assert');
const pipe = require('lodash/fp/flow');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const { models: modelsConfig } = require('../config');
const modelSetup = require('./utils/model-setup');
const defItemsModel = require('./deficient-items');
const inspectionsModel = require('./inspections');
const updateDeficientItemsAttrs = require('../properties/utils/update-deficient-items-attrs');

const PREFIX = 'models: properties:';
const PROPERTY_COLLECTION = modelsConfig.collections.properties;
const PROPERTY_BUCKET_NAME = `propertyImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;

// Pipeline of steps to update metadata
const propertyMetaUpdates = pipe([
  updateNumOfInspections,
  updateLastInspectionAttrs,
  updateDeficientItemsAttrs,
]);

module.exports = modelSetup({
  /**
   * Lookup all properties
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  findAll(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(PROPERTY_COLLECTION).get();
  },

  /**
   * Batch remove all firestore property
   * relationships to a deleted team
   * @param  {admin.firestore} db
   * @param  {String[]} propertyIds
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  batchRemoveTeam(db, propertyIds, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      propertyIds && Array.isArray(propertyIds),
      'has property ids is an array'
    );
    assert(
      propertyIds.every(id => id && typeof id === 'string'),
      'property ids is an array of strings'
    );
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has firestore batch/transaction'
      );
    }

    const batch = parentBatch || db.batch();
    const collection = db.collection(PROPERTY_COLLECTION);

    // Remove each properties team
    propertyIds.forEach(id => {
      const propertyDoc = collection.doc(id);
      batch.update(propertyDoc, { team: FieldValue.delete() });
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Batch remove all firestore property
   * relationships to a deleted template
   * @param  {admin.firestore} db
   * @param  {String[]} propertyIds
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  batchRemoveTemplate(db, propertyIds, templateId, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      propertyIds && Array.isArray(propertyIds),
      'has property ids is an array'
    );
    assert(
      propertyIds.every(id => id && typeof id === 'string'),
      'property ids is an array of strings'
    );
    assert(templateId && typeof templateId === 'string', 'has template id');
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has firestore batch/transaction'
      );
    }

    const batch = parentBatch || db.batch();
    const collection = db.collection(PROPERTY_COLLECTION);

    // Remove each properties team
    propertyIds.forEach(id => {
      const propertyDoc = collection.doc(id);
      batch.update(propertyDoc, {
        [`templates.${templateId}`]: FieldValue.delete(),
      });
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Lookup Firestore Property
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  findRecord(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .get();
  },

  /**
   * Create a Firestore property
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, propertyId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    if (propertyId === undefined)
      propertyId = db.collection(PROPERTY_COLLECTION).doc().id;
    return db
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .create(data);
  },

  /**
   * Create a firestore doc id for collection
   * @param  {admin.firestore} db
   * @return {String}
   */
  createId(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(PROPERTY_COLLECTION).doc().id;
  },

  /**
   * Create a firestore document reference
   * @param  {admin.firestore} db
   * @param  {String} id
   * @return {firestore.DocumentReference}
   */
  createDocRef(db, id) {
    assert(id && typeof id === 'string', 'has document reference id');
    return db.collection(PROPERTY_COLLECTION).doc(id);
  },

  /**
   * Update Firestore Property
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @param  {Object} data
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  updateRecord(db, propertyId, data, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has update data');

    const docRef = db.collection(PROPERTY_COLLECTION).doc(propertyId);

    if (parentBatch) {
      parentBatch.update(docRef, data);
      return Promise.resolve(parentBatch);
    }

    return docRef.update(data);
  },

  /**
   * Create or update a Firestore property
   * @param  {admin.firestore} db
   * @param  {String}  propertyId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(db, propertyId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = db.collection(PROPERTY_COLLECTION).doc(propertyId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;
    const current = docSnap.data() || {};
    const upsert = { ...data };

    // Trim inspection data to be boolean
    // hash, instead of a nested inspection records
    if (upsert.inspections) {
      Object.keys(upsert.inspections).forEach(inspId => {
        upsert.inspections[inspId] = true;
      });
    }

    try {
      if (exists) {
        // Replace optional field nulls
        // with Firestore delete values
        if (current.templates && data.templates === null) {
          upsert.templates = FieldValue.delete();
        }
        if (current.inspections && data.inspections === null) {
          upsert.inspections = FieldValue.delete();
        }

        await docRef.update(upsert, { merge: true });
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.templates) delete upsert.templates;
        if (!upsert.inspections) delete upsert.inspections;
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
   * Remove Firestore Property
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  removeRecord(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .delete();
  },

  /**
   * Query all properties
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    let dbQuery = db.collection(PROPERTY_COLLECTION);

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
   * Update a property's metadata relating
   * to inspections and deficiencies
   * @param  {admin.firestore} db - Firestore Admin DB instance
   * @param  {String} propertyId
   * @param  {firestore.batch?} parentBatch
   * @return {Promise} - resolves {Object} updates
   */
  async updateMetaData(db, propertyId, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    // Lookup all property's inspections
    const inspections = [];
    try {
      const inspectionsSnap = await inspectionsModel.query(db, {
        property: ['==', propertyId],
        completionDate: ['>', 0],
      });
      inspectionsSnap.docs.forEach(doc => {
        inspections.push({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      throw Error(`${PREFIX} property inspection lookup failed: ${err}`);
    }

    // Find any deficient items data for property
    const propertyDeficiencies = [];
    try {
      const deficienciesSnap = await defItemsModel.queryByProperty(
        db,
        propertyId
      );
      deficienciesSnap.docs.forEach(doc => {
        const data = doc.data();
        // If deficiency has any state
        if (data.state) {
          propertyDeficiencies.push({ ...data, id: data.id });
        }
      });
    } catch (err) {
      throw Error(
        `${PREFIX} failed to lookup properties deficicent items: ${err}`
      );
    }

    // Collect updates to write to property's metadata attrs
    const { updates } = propertyMetaUpdates({
      propertyId,
      inspections,
      deficientItems: propertyDeficiencies,
      updates: {},
    });

    // Update Firebase Property
    try {
      await this.updateRecord(db, propertyId, updates, parentBatch);
    } catch (err) {
      throw Error(`${PREFIX} failed to update property metadata: ${err}`);
    }

    return updates;
  },

  /**
   * Delete a property's image uploads
   * TODO: Move to properties storage service
   * @param  {admin.storage} storage
   * @param  {String} url
   * @return {Promise}
   */
  deleteUpload(storage, url) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(url && typeof url === 'string', 'has url string');

    const fileName = (decodeURIComponent(url).split('?')[0] || '')
      .split('/')
      .pop();

    return storage
      .bucket()
      .file(`${PROPERTY_BUCKET_NAME}/${fileName}`)
      .delete()
      .catch(err => Promise.reject(Error(`${PREFIX} deleteUpload: ${err}`)));
  },

  /**
   * Lookup Property's team relationships
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {firestore.transaction?} transaction
   * @return {Promise}
   */
  findAllTeamRelationships(db, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    const query = db
      .collection(PROPERTY_COLLECTION)
      .orderBy('team')
      .where('team', '>', '')
      .select('team');

    if (transaction) {
      assert(typeof transaction.get === 'function', 'has transaction instance');
      return Promise.resolve(transaction.get(query));
    }

    return query.get();
  },
});

/**
 * Configure update for all a property's
 * completed inspections
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateNumOfInspections(
  config = { propertyId: '', inspections: [], updates: {} }
) {
  config.updates.numOfInspections = config.inspections.reduce(
    (acc, { inspectionCompleted }) => {
      if (inspectionCompleted) {
        acc += 1;
      }

      return acc;
    },
    0
  );

  return config;
}

/**
 * Configure update for a property's
 * latest inspection attributes
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateLastInspectionAttrs(
  config = { propertyId: '', inspections: [], updates: {} }
) {
  const [latestInspection] = config.inspections.sort(
    (a, b) => b.completionDate - a.completionDate
  ); // DESC

  if (latestInspection && latestInspection.inspectionCompleted) {
    config.updates.lastInspectionScore = latestInspection.score;
    config.updates.lastInspectionDate = latestInspection.completionDate;
  }

  return config;
}
