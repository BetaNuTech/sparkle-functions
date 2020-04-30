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
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
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
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );

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
   * Lookup Firestore Property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  firestoreFindRecord(fs, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
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
        if (current.templates && !upsert.templates) {
          upsert.templates = FieldValue.delete();
        }
        if (current.inspections && !upsert.inspections) {
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
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    return fs
      .collection(PROPERTY_COLLECTION)
      .doc(propertyId)
      .delete();
  },
});
