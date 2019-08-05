const assert = require('assert');
const got = require('got');
const modelSetup = require('./utils/model-setup');
const { firebase: firebaseConfig } = require('../config');
const log = require('../utils/logger');

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
   * Create or update system's Trello credentials
   * for a property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {Object} config
   * @return {Promise}
   */
  upsertPropertyTrelloCredentials(db, config) {
    const { propertyId, member, authToken, apikey, user } = config;

    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      member && typeof member === 'string',
      `${PREFIX} has Trello member id`
    );
    assert(
      authToken && typeof authToken === 'string',
      `${PREFIX} has Trello auth token`
    );
    assert(
      apikey && typeof apikey === 'string',
      `${PREFIX} has Trello API key`
    );
    assert(user && typeof user === 'string', `${PREFIX} has Firebase User id`);

    // Update system credentials /wo overwriting
    // any other date under property's cendentials
    return db
      .ref(`/system/integrations/trello/properties/${propertyId}`)
      .update({
        [`${SERVICE_ACCOUNT_CLIENT_ID}/member`]: member,
        [`${SERVICE_ACCOUNT_CLIENT_ID}/authToken`]: authToken,
        [`${SERVICE_ACCOUNT_CLIENT_ID}/apikey`]: apikey,
        [`${SERVICE_ACCOUNT_CLIENT_ID}/user`]: user,
      });
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

  /**
   * check trello for deficient item card
   * and archive if exists
   * @param  {firebaseadmin.database} db
   * @param  {Object} deficientItem
   * @param  {Boolean} archiving if the trello card should be archived or unarchived
   * @return {Promise}
   */
  async archiveTrelloCard(db, deficientItem, archiving) {
    // Lookup inspection
    let inspectionSnap;
    try {
      inspectionSnap = await db
        .ref(`inspections/${deficientItem.inspection}`)
        .once('value');
    } catch (err) {
      throw Error(`${PREFIX} inspection lookup failed: ${err}`);
    }

    const { property: propertyId } = inspectionSnap.val();

    const integrationPath = `/system/integrations/trello/properties/${propertyId}/${SERVICE_ACCOUNT_CLIENT_ID}`;
    // Lookup system credentials
    let propertyTrelloCredentialsSnap;
    try {
      propertyTrelloCredentialsSnap = await db
        .ref(integrationPath)
        .once('value');
    } catch (err) {
      throw Error(`${PREFIX} failed trello system credential lookup: ${err}`);
    }

    if (!propertyTrelloCredentialsSnap.exists()) {
      return null;
    }

    const trelloCredentials = propertyTrelloCredentialsSnap.val();

    if (!trelloCredentials.cards) {
      return null;
    }

    // Find any card reference stored for DI
    const [cardId] = Object.keys(trelloCredentials.cards).filter(
      id => trelloCredentials.cards[id] === deficientItem.item
    );

    if (!cardId) {
      return null;
    }

    let response;
    try {
      response = await trelloCardRequest(
        cardId,
        trelloCredentials.apikey,
        trelloCredentials.authToken,
        'PUT',
        archiving
      );
    } catch (err) {
      if (err.statusCode === 404) {
        log.info(
          `${PREFIX} card not found, removing card from trello integration object`
        );

        try {
          await db.ref(`${integrationPath}/cards/${cardId}`).remove();
        } catch (error) {
          log.error(
            `${PREFIX} error when removing card from trello integration path`
          );
        }
      }

      throw Error(
        `${PREFIX} archive PUT card ${cardId} to trello API failed: ${err}`
      );
    }

    return response;
  },

  /**
   * TODO: Deprecate after nocking
   * Trello card archiving E2E tests
   */
  trelloCardRequest,
});

/**
 * for interacting with trello cards
 * @param  {string} cardId id of card which needs interaction
 * @param  {string} apikey api key for trello
 * @param  {string} authToken authToken for trello
 * @param  {string} method - http method
 * @param  {boolean?} closed - archive/unarchive trello card
 * @return {promise} - resolves {object} trello card json
 */
function trelloCardRequest(cardId, apikey, authToken, method, closed = true) {
  assert(cardId && typeof cardId === 'string', `${PREFIX} has card id`);
  assert(apikey && typeof apikey === 'string', `${PREFIX} has api key`);
  assert(
    authToken && typeof authToken === 'string',
    `${PREFIX} has authentication token`
  );
  assert(method && typeof method === 'string', `${PREFIX} has http method`);

  return got(
    `https://api.trello.com/1/cards/${cardId}?key=${apikey}&token=${authToken}`,
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
}
