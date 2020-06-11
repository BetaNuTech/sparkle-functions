const assert = require('assert');
const pipe = require('lodash/fp/flow');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const defItemsModel = require('./deficient-items');
const inspectionsModel = require('./inspections');
const updateDeficientItemsAttrs = require('../properties/utils/update-deficient-items-attrs');

const PREFIX = 'models: properties:';
const PROPERTY_COLLECTION = 'properties';
const PROPERTIES_DB = '/properties';
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
   * Find property by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} snapshot
   */
  findRecord(db, propertyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db.ref(`${PROPERTIES_DB}/${propertyId}`).once('value');
  },

  /**
   * Remove property by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, propertyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db.ref(`${PROPERTIES_DB}/${propertyId}`).remove();
  },

  /**
   * Add/update Property
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, propertyId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${PROPERTIES_DB}/${propertyId}`).update(data);
  },

  /**
   * Get all properties belonging to a team
   * @param  {admin.database} db
   * @param  {String} teamId
   * @return {Promise} - resolves {DataSnapshot} teams snapshot
   */
  getPropertiesByTeamId(db, teamId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    return db
      .ref('properties')
      .orderByChild('team')
      .equalTo(teamId)
      .once('value');
  },

  /**
   * Batch remove all property relationships
   * to a deleted team
   * @param  {admin.database} db
   * @param  {String[]} propertyIds
   * @return {Promise}
   */
  realtimeBatchRemoveTeam(db, propertyIds) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(
      propertyIds && Array.isArray(propertyIds),
      'has property ids is an array'
    );
    assert(
      propertyIds.every(id => id && typeof id === 'string'),
      'property ids is an array of strings'
    );
    const batchRemove = {};

    // Collect all updates to properties
    propertyIds.forEach(propertyId => {
      batchRemove[`${PROPERTIES_DB}/${propertyId}/team`] = null;
    });

    return db.ref().update(batchRemove);
  },

  /**
   * Lookup property by its' code
   * @param  {admin.firebase} db
   * @param  {String} propertyCode
   * @return {Promise} - resolves {DataSnapshot}
   */
  realtimeQueryByCode(db, propertyCode) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyCode, 'has property code');
    return db
      .ref('properties')
      .orderByChild('code')
      .equalTo(propertyCode)
      .limitToFirst(1)
      .once('value');
  },

  /**
   * Batch remove all firestore property
   * relationships to a deleted team
   * @param  {admin.firestore} fs
   * @param  {String[]} propertyIds
   * @return {Promise}
   */
  firestoreBatchRemoveTeam(fs, propertyIds) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      propertyIds && Array.isArray(propertyIds),
      'has property ids is an array'
    );
    assert(
      propertyIds.every(id => id && typeof id === 'string'),
      'property ids is an array of strings'
    );

    const batch = fs.batch();
    const collection = fs.collection(PROPERTY_COLLECTION);

    // Remove each properties team
    propertyIds.forEach(id => {
      const propertyDoc = collection.doc(id);
      batch.update(propertyDoc, { team: FieldValue.delete() });
    });

    return batch.commit();
  },

  /**
   * Lookup Firestore Property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  firestoreFindRecord(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return fs
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .get();
  },

  /**
   * Create a Firestore property
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, propertyId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .create(data);
  },

  /**
   * Create or update a Firestore property
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  propertyId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, propertyId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(PROPERTY_COLLECTION).doc(propertyId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
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
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Remove Firestore Property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return fs
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .delete();
  },

  /**
   * Query all properties
   * @param  {admin.firestore} fs
   * @param  {Object} query
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQuery(fs, query, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');

    const fsQuery = fs.colletion(PROPERTY_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      fsQuery.where(attr, ...queryArgs);
    });

    if (batch) {
      assert(typeof batch.get === 'function', 'has firestore batch');
      return Promise.resolve(batch.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Update a property's metadata relating
   * to inspections and deficiencies
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {Object} updates
   */
  async updateMetaData(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    // Lookup all property's inspections
    const inspections = [];
    try {
      const inspectionsSnap = await inspectionsModel.firestoreQueryByProperty(
        fs,
        propertyId
      );
      inspectionsSnap.docs.forEach(doc => {
        inspections.push({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      throw Error(`${PREFIX} property inspection lookup failed: ${err}`);
    }

    // Find any deficient items data for property
    const propertyDeficiencies = [];
    try {
      const deficienciesSnap = await defItemsModel.firestoreQueryByProperty(
        fs,
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
      await this.firestoreUpsertRecord(fs, propertyId, updates);
    } catch (err) {
      throw Error(`${PREFIX} failed to update property metadata: ${err}`);
    }

    return updates;
  },

  /**
   * Delete a property's image uploads
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
    (a, b) => b.creationDate - a.creationDate
  ); // DESC

  if (latestInspection && latestInspection.inspectionCompleted) {
    config.updates.lastInspectionScore = latestInspection.score;
    config.updates.lastInspectionDate = latestInspection.creationDate;
  }

  return config;
}
