const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: properties:';
const PROPERTY_COLLECTION = 'properties';
const PROPERTIES_DB = '/properties';

module.exports = modelSetup({
  /**
   * Find property by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} snapshot
   */
  findRecord(db, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );

    return db.ref(`${PROPERTIES_DB}/${propertyId}`).once('value');
  },

  /**
   * Remove property by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  realtimeRemoveRecord(db, propertyId) {
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
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
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
   * Create or update a Firestore property
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  propertyId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, propertyId, data) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);

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
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return fs
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .delete();
  },
});
