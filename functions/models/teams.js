const modelSetup = require('./utils/model-setup');
const adminUtils = require('../utils/firebase-admin');

const LOG_PREFIX = 'models: teams:';

module.exports = modelSetup({
  /**
   * This is a helper function used to get all of the property - team relationships
   * @param  {firebaseAdmin.database} db
   * @return {Promise} - resolves {Object} hash of all teams/properties to be used as a source of truth
   */
  async getPropertyRelationships(db) {
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
      throw Error(`${LOG_PREFIX} getPropertyRelationships: ${err}`); // wrap error
    }

    return propertyAndTeam;
  },

  /**
   * This function will retrieve all properties that belong to the requested team
   * @param {firebaseAdmin.database} db firbase database
   * @param {number} teamId this is the id of the team we are looking for
   * @returns this will return an firebase snapshot containing all properties that belong to the requested team
   */
  getPropertiesByTeamId(db, teamId) {
    return db
      .ref('properties')
      .orderByChild('team')
      .equalTo(teamId)
      .once('value');
  },
});
