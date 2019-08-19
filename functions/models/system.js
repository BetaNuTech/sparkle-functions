const assert = require('assert');
const got = require('got');
const modelSetup = require('./utils/model-setup');
const config = require('../config');
const integrationsModel = require('./integrations');

const PREFIX = 'models: system:';
const SERVICE_ACCOUNT_CLIENT_ID =
  config.firebase.databaseAuthVariableOverride.uid;
const DI_DATABASE_PATH = config.deficientItems.dbPath;
const TRELLO_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/trello/organization`;
const TRELLO_PROPERTIES_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/trello/properties`;
const SLACK_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/slack/organization`;

module.exports = modelSetup({
  /**
   * Lookup Trello integration credentials for organization
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} trello system integration
   */
  findTrelloCredentials(db) {
    return db.ref(TRELLO_ORG_PATH).once('value');
  },

  /**
   * Remove Trello integration credentials for organization
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise}
   */
  destroyTrelloCredentials(db) {
    return db.ref(TRELLO_ORG_PATH).remove();
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
   * @param  {Object} settings
   * @return {Promise}
   */
  upsertPropertyTrelloCredentials(db, settings) {
    const { member, authToken, apikey, user, trelloUsername } = settings;

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
    assert(user && typeof user === 'string', `${PREFIX} has Firebase user id`);
    assert(
      trelloUsername && typeof trelloUsername === 'string',
      `${PREFIX} has Trello username`
    );

    // Update system credentials /wo overwriting
    // any other date under property's cendentials
    return db.ref(TRELLO_ORG_PATH).update({
      member,
      authToken,
      apikey,
      user,
      trelloUsername,
    });
  },

  /**
   * Appends a Trello card reference to system's
   * integration record for a specified property
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @param  {String} trelloCard
   * @param  {String} deficientItem
   * @param  {String} trelloCardURL
   * @return {Promise} - resolves {undefined}
   */
  async createPropertyTrelloCard(db, settings) {
    const { property, trelloCard, deficientItem, trelloCardURL } = settings;

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
    assert(
      trelloCardURL && typeof trelloCardURL === 'string',
      `${PREFIX} has trello card URL`
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

    return db.ref().update({
      [`${TRELLO_PROPERTIES_PATH}/${property}/cards/${trelloCard}`]: deficientItem,
      [`${DI_DATABASE_PATH}/${property}/${deficientItem}/trelloCardURL`]: trelloCardURL,
    });
  },

  /**
   * Find any Trello Card ID associated with
   * a Deficient Item
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {String} Trello card ID
   */
  async _findTrelloCardId(db, propertyId, deficientItemId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item id`
    );

    // Lookup system credentials
    let propertyTrelloCards;
    try {
      const propertyTrelloCardsSnap = await db
        .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards`)
        .once('value');
      propertyTrelloCards = propertyTrelloCardsSnap.val() || {};
    } catch (err) {
      throw Error(
        `${PREFIX}: _findTrelloCardId: failed to fetch trello cards for property: "${propertyId}" | ${err}`
      );
    }

    // Find any card reference stored for DI
    return (
      Object.keys(propertyTrelloCards).filter(
        id => propertyTrelloCards[id] === deficientItemId
      )[0] || ''
    );
  },

  /**
   * Check trello for deficient item card
   * and archive if exists
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {Boolean} archiving if the trello card should be archived or unarchived
   * @return {Promise} - resolves {Object} Trello API response
   */
  async archiveTrelloCard(db, propertyId, deficientItemId, archiving) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item id`
    );
    assert(typeof archiving === 'boolean', `${PREFIX} has archiving boolean`);

    let trelloCardId = '';
    try {
      trelloCardId = await this._findTrelloCardId(
        db,
        propertyId,
        deficientItemId
      );
    } catch (err) {
      throw Error(
        `${PREFIX}: archiveTrelloCard: trello card lookup failed: ${err}`
      );
    }

    // DI has no Trello card to archive
    if (!trelloCardId) {
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

    let response = null;
    try {
      response = await archiveTrelloCardRequest(
        trelloCardId,
        trelloCredentials.apikey,
        trelloCredentials.authToken,
        'PUT',
        archiving
      );
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} archive PUT card ${trelloCardId} to trello API failed: ${err}`
      );

      // Handle Deleted Trello card
      if (err.statusCode === 404) {
        resultErr.code = 'ERR_TRELLO_CARD_DELETED';

        try {
          await this._cleanupDeletedTrelloCard(
            db,
            propertyId,
            deficientItemId,
            trelloCardId
          );
        } catch (cleanUpErr) {
          resultErr.message += `${cleanUpErr}`; // append to primary error
        }
      }

      throw resultErr;
    }

    return response;
  },

  /**
   * Close any Trello card previously created
   * for a Deficient Item
   * @param  {firebaseadmin.database} db
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {Object} `null` or Trello API response
   */
  async closeDeficientItemsTrelloCard(db, propertyId, deficientItemId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item ID`
    );

    // Lookup any Trello card for DI
    let cardId = '';
    try {
      cardId = await this._findTrelloCardId(db, propertyId, deficientItemId);
      if (!cardId) return null;
    } catch (err) {
      throw Error(
        `${PREFIX}: closeDeficientItemsTrelloCard: trello card lookup failed: ${err}`
      );
    }

    // Lookup any close list for property
    let closeList = '';
    try {
      const trelloIntegrationSnap = await integrationsModel.findByTrelloProperty(
        db,
        propertyId
      );

      const trelloIntegration = trelloIntegrationSnap.val() || {};
      closeList = trelloIntegration.closeList;
      if (!closeList) return null;
    } catch (err) {
      throw Error(
        `${PREFIX}: closeDeficientItemsTrelloCard: property trello integration lookup failed: ${err}`
      );
    }

    // Lookup Trello credentials
    let apikey = '';
    let authToken = '';
    try {
      const trelloCredentialsSnap = await this.findTrelloCredentials(db);
      const trelloCredentials = trelloCredentialsSnap.val() || {};
      apikey = trelloCredentials.apikey;
      authToken = trelloCredentials.authToken;
      if (!apikey || !authToken) return null;
    } catch (err) {
      throw Error(
        `${PREFIX} closeDeficientItemsTrelloCard: failed to recover trello credentials: ${err}`
      );
    }

    // Move Trello card to close list
    return got(
      `https://api.trello.com/1/cards/${cardId}?key=${apikey}&token=${authToken}&idList=${closeList}`,
      {
        headers: { 'content-type': 'application/json' },
        body: {},
        responseType: 'json',
        method: 'PUT',
        json: true,
      }
    );
  },

  /**
   * Used to cleanup Trello card references
   * when the card has been manually removed
   * from the Trello admin and returns 404's
   * to any API requests
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyId
   * @param  {String}  deficientItemId
   * @param  {String}  trelloCardId
   * @return {Promise}
   */
  async _cleanupDeletedTrelloCard(
    db,
    propertyId,
    deficientItemId,
    trelloCardId
  ) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item ID`
    );
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      `${PREFIX} has Trello card ID`
    );

    // Remove the Trello card reference from property integration
    try {
      await db
        .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards/${trelloCardId}`)
        .remove();
    } catch (err) {
      throw Error(
        `${PREFIX} error removing card from trello integration path | ${err}`
      );
    }

    // Remove any Trello card URL's on DI's
    try {
      await db.ref().update({
        [`${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/trelloCardURL`]: null,
        [`archive${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/trelloCardURL`]: null,
      });
    } catch (err) {
      throw Error(`${PREFIX} error removing Trello card URL from DI | ${err}`);
    }
  },
});

/**
 * for interacting with trello cards
 * @param  {string} cardId id of card which needs interaction
 * @param  {string} apikey api key for trello
 * @param  {string} authToken authToken for trello
 * @param  {string} method - http method
 * @param  {boolean?} archive - archive/unarchive trello card
 * @return {promise} - resolves {object} trello card json
 */
function archiveTrelloCardRequest(
  cardId,
  apikey,
  authToken,
  method,
  archive = true
) {
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
      body: method !== 'GET' ? { closed: archive } : null,
      responseType: 'json',
      method,
      json: true,
    }
  );
}
