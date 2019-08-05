const assert = require('assert');
const got = require('got');
const modelSetup = require('./utils/model-setup');
const { firebase: firebaseConfig } = require('../config');
const log = require('../utils/logger');

const PREFIX = 'models: system:';
const SERVICE_ACCOUNT_CLIENT_ID =
  firebaseConfig.databaseAuthVariableOverride.uid;
const TRELLO_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/trello/organization`;
const TRELLO_PROPERTIES_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/trello/properties`;
const SLACK_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/slack/organization`;

module.exports = modelSetup({
  /**
   * Lookup Trello integration credentials for property
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} trello system integration
   */
  findTrelloCredentials(db) {
    return db.ref(TRELLO_ORG_PATH).once('value');
  },

  /**
   * Lookup Slack integration credentials
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} Slack system integration
   */
  findSlackCredentials(db) {
    return db.ref(SLACK_ORG_PATH).once('value');
  },

  /**
   * Create or update organizations' Slack credentials
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} accessToken
   * @param  {String} scope - scope for provided access token
   * @return {Promise}
   */
  upsertSlackAppCredentials(db, accessToken, scope) {
    return db.ref(SLACK_ORG_PATH).update({
      accessToken,
      scope,
      createdAt: Date.now() / 1000,
    });
  },

  /**
   * Create or update organization's Trello credentials
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {Object} config
   * @return {Promise}
   */
  upsertPropertyTrelloCredentials(db, config) {
    const { member, authToken, apikey, user } = config;

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
    return db.ref(TRELLO_ORG_PATH).update({
      member,
      authToken,
      apikey,
      user,
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
      .ref(`${TRELLO_PROPERTIES_PATH}/${property}/cards`)
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
      .ref(`${TRELLO_PROPERTIES_PATH}/${property}/cards/${trelloCard}`)
      .set(deficientItem);
  },

  /**
   * Check trello for deficient item card
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

    // Lookup system credentials
    let propertyTrelloCardsSnap;
    try {
      propertyTrelloCardsSnap = await db
        .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards`)
        .once('value');
    } catch (err) {
      throw Error(
        `${PREFIX} failed to fetch trello cards for property: "${propertyId}" | ${err}`
      );
    }

    if (!propertyTrelloCardsSnap.exists()) {
      return null;
    }

    const propertyTrelloCards = propertyTrelloCardsSnap.val();

    if (!propertyTrelloCards.cards) {
      return null;
    }

    // Find any card reference stored for DI
    const [cardId] = Object.keys(propertyTrelloCards).filter(
      id => propertyTrelloCards[id] === deficientItem.item
    );

    if (!cardId) {
      return null;
    }

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await this.findTrelloCredentials(db);

      if (!trelloCredentialsSnap.exists()) throw Error();
      trelloCredentials = trelloCredentialsSnap.val();
    } catch (err) {
      throw Error(`${PREFIX} failed to recover trello credentials: ${err}`);
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
          await db
            .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards/${cardId}`)
            .remove();
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
