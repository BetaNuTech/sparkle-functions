const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const { firebase: firebaseConfig } = require('../config');

const PREFIX = 'models: system:';
const SERVICE_ACCOUNT_CLIENT_ID =
  firebaseConfig.databaseAuthVariableOverride.uid;

module.exports = modelSetup({
  /**
   * Lookup Trello integration credentials for property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} trello system integration
   */
  findTrelloCredentialsForProperty(db, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );

    return db
      .ref(
        `/system/integrations/trello/properties/${propertyId}/${SERVICE_ACCOUNT_CLIENT_ID}`
      )
      .once('value');
  },
});
