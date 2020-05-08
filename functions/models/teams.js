const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const adminUtils = require('../utils/firebase-admin');

const PREFIX = 'models: teams:';
const TEAMS_DB = '/teams';
const TEAMS_COLLECTION = 'teams';

module.exports = modelSetup({
  /**
   * This is a helper function used to get all of the property - team relationships
   * @param  {firebaseAdmin.database} db
   * @return {Promise} - resolves {Object} hash of all teams/properties to be used as a source of truth
   */
  async getPropertyRelationships(db) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    const propertyAndTeam = {};

    try {
      // load all properties team associations (source of truth)
      await adminUtils.forEachChild(
        db,
        '/properties',
        function buildSourceOfTruth(propertyId, property) {
          if (property.team) {
            propertyAndTeam[property.team] =
              propertyAndTeam[property.team] || {};
            propertyAndTeam[property.team][propertyId] = true;
          }
        }
      );
    } catch (err) {
      throw Error(`${PREFIX} getPropertyRelationships: ${err}`); // wrap error
    }

    return propertyAndTeam;
  },

  /**
   * Find realtime team record
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} teamId
   * @return {Promise} - resolves {DataSnapshot} team snapshot
   */
  realtimeFindRecord(db, teamId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    return db.ref(`${TEAMS_DB}/${teamId}`).once('value');
  },

  /**
   * Add/update realtime team
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} teamId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, teamId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(teamId && typeof teamId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has upsert data');
    return db.ref(`${TEAMS_DB}/${teamId}`).update(data);
  },

  /**
   * Lookup Firestore Property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} teamId
   * @return {Promise}
   */
  firestoreFindRecord(fs, teamId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    return fs
      .collection(TEAMS_COLLECTION)
      .doc(teamId)
      .get();
  },

  /**
   * Create or update a Firestore team
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  teamId
   * @param  {Object}  data
   * @return {Promise} - resolves {DocumentReference}
   */
  async firestoreUpsertRecord(fs, teamId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = fs.collection(TEAMS_COLLECTION).doc(teamId);
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
        if (upsert.properties === null) {
          upsert.properties = FieldValue.delete();
        }

        await docRef.update(upsert);
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.properties) delete upsert.properties;
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
});
