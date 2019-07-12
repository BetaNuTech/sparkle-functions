const assert = require('assert');
const got = require('got');
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

  /**
   * Lookup Slack integration credentials
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} Slack system integration
   */
  findSlackCredentials(db) {
    return db
      .ref(
        `/system/integrations/slack/organization/${SERVICE_ACCOUNT_CLIENT_ID}`
      )
      .once('value');
  },

  /**
   * for interacting with trello cards
   * @param  {String} cardID ID of card which needs interaction
   * @param  {String} apikey api key for trello
   * @param  {String} authToken authToken for trello
   * @param  {String} method - HTTP method
   * @param  {Boolean?} closed - archive/unarchive Trello card
   * @return {Promise} - resolves {Object} Trello card JSON
   */
  trelloCardRequest(cardID, apikey, authToken, method, closed = true) {
    assert(cardID && typeof cardID === 'string', `${PREFIX} has card id`);
    assert(apikey && typeof apikey === 'string', `${PREFIX} has api key`);
    assert(
      authToken && typeof authToken === 'string',
      `${PREFIX} has authentication token`
    );
    assert(method && typeof method === 'string', `${PREFIX} has HTTP method`);

    return got(
      `https://api.trello.com/1/cards/${cardID}?key=${apikey}&token=${authToken}`,
      {
        headers: {
          'content-type': 'application/json',
        },
        body: method !== 'GET' ? { closed } : null,
        responseType: 'json',
        method,
        json: true,
      }
    );
  },

  /**
   * Appends a Trello card reference to system's
   * integration record for a specified property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @param  {String} trelloCard
   * @param  {String} deficientItem
   * @return {Promise} - resolves {undefined}
   */
  async createPropertyTrelloCard(db, settings) {
    const { property, trelloCard, deficientItem } = settings;

    assert(
      property && typeof property === 'string',
      `${PREFIX} has property id`
    );
    assert(
      trelloCard && typeof trelloCard === 'string',
      `${PREFIX} has trello card id`
    );
    assert(
      deficientItem && typeof deficientItem === 'string',
      `${PREFIX} has deficient item id`
    );

    const cardsSnap = await db
      .ref(
        `/system/integrations/trello/properties/${property}/${SERVICE_ACCOUNT_CLIENT_ID}/cards`
      )
      .once('value');

    // checking if there already exists a trello card for this inspection item, if so will throw error
    if (cardsSnap.exists()) {
      const cards = cardsSnap.val();
      const trelloCardExists = Object.values(cards).includes(deficientItem);

      if (trelloCardExists) {
        throw Error(
          `${PREFIX} Trello card for this inspection item already exists`
        );
      }
    }

    return db
      .ref(
        `/system/integrations/trello/properties/${property}/${SERVICE_ACCOUNT_CLIENT_ID}/cards/${trelloCard}`
      )
      .set(deficientItem);
  },
});
