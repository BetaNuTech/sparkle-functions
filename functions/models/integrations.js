const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';

module.exports = modelSetup({
  /**
   * Lookup Trello integration setting for property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} trello integration
   */
  findByTrelloProperty(db, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    return db
      .ref(`/integrations/trello/properties/${propertyId}`)
      .once('value');
  },
});
