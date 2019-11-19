const assert = require('assert');
const got = require('got');
const modelSetup = require('./utils/model-setup');
const config = require('../config');

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
   * Remove Slack integration credentials for organization
   * @param  {firebaseAdmin.database} db firebase database
   * @return {Promise}
   */
  destroySlackCredentials(db) {
    return db.ref(SLACK_ORG_PATH).remove();
  },

  /**
   * Create or replace organization's Trello credentials
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {Object} settings
   * @return {Promise}
   */
  createTrelloCredentials(db, settings) {
    const { authToken, apikey, user } = settings;

    assert(
      authToken && typeof authToken === 'string',
      `${PREFIX} has Trello auth token`
    );
    assert(
      apikey && typeof apikey === 'string',
      `${PREFIX} has Trello API key`
    );
    assert(user && typeof user === 'string', `${PREFIX} has Firebase user id`);

    const result = {
      authToken,
      apikey,
      user,
    };

    // Update system credentials /wo overwriting
    // any other date under property's cendentials
    return db.ref(TRELLO_ORG_PATH).set(result);
  },

  /**
   * Appends a Trello card reference to system's
   * integration record for a specified property
   * NOTE: Check for Trello Card existence before calling
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} propertyId
   * @param  {String} trelloCard
   * @param  {String} deficientItem
   * @param  {String} trelloCardURL
   * @return {Promise} - resolves {undefined}
   */
  createPropertyTrelloCard(db, settings) {
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
  async findTrelloCardId(db, propertyId, deficientItemId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item id`
    );

    // Lookup system credentials
    let propertyTrelloCards = null;
    try {
      const propertyTrelloCardsSnap = await db
        .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards`)
        .once('value');
      propertyTrelloCards = propertyTrelloCardsSnap.val() || {};
    } catch (err) {
      throw Error(
        `${PREFIX}: find-trello-card-id: failed to fetch trello cards for property: "${propertyId}" | ${err}`
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
   * Boolean wrapper around `findTrelloCardId`
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {Boolean} Trello card existence in Firebase
   */
  isDeficientItemTrelloCardCreated(db, propertyId, deficientItemId) {
    return this.findTrelloCardId(db, propertyId, deficientItemId).then(result =>
      Boolean(result)
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
      trelloCardId = await this.findTrelloCardId(
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
    let apikey = '';
    let authToken = '';
    try {
      const trelloCredentialsSnap = await this.findTrelloCredentials(db);

      if (!trelloCredentialsSnap.exists()) throw Error();
      const trelloCredentials = trelloCredentialsSnap.val() || {};
      apikey = trelloCredentials.apikey;
      authToken = trelloCredentials.authToken;
    } catch (err) {
      throw Error(`${PREFIX} failed to recover trello credentials: ${err}`);
    }

    if (!apikey || !authToken) {
      return null;
    }

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/cards/${trelloCardId}?key=${apikey}&token=${authToken}`,
        {
          headers: { 'content-type': 'application/json' },
          body: { closed: archiving },
          responseType: 'json',
          method: 'PUT',
          json: true,
        }
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

    // remove Trello card attachment id on DI
    try {
      const completedPhotos = await db
        .ref(
          `${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/completedPhotos`
        )
        .once('value');
      if (completedPhotos.exists()) {
        await Promise.all(
          Object.keys(completedPhotos.val()).map(async key => {
            await db.ref().update({
              [`${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/completedPhotos/${key}/trelloCardAttachement`]: null,
            });
          })
        );
      }

      const archivedCompletedPhotos = await db
        .ref(
          `archive${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/completedPhotos`
        )
        .once('value');
      if (archivedCompletedPhotos.exists()) {
        await Promise.all(
          Object.keys(archivedCompletedPhotos.val()).map(async key => {
            await db.ref().update({
              [`archive${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/completedPhotos/${key}/trelloCardAttachement`]: null,
            });
          })
        );
      }
    } catch (err) {
      throw Error(
        `${PREFIX} error removing Trello attachment ID from DI completed photos | ${err}`
      );
    }
  },

  /**
   * POST a Trello card comment
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyId
   * @param  {String}  deficientItemId
   * @param  {String}  trelloCardId
   * @param  {String}  text
   * @return {Promise} - resolves {Object} Trello API response
   */
  async postTrelloCardComment(
    db,
    propertyId,
    deficientItemId,
    trelloCardId,
    text
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
      `${PREFIX} has Trello Card id`
    );
    assert(text && typeof text === 'string', `${PREFIX} has comment text`);

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
        `${PREFIX} postTrelloCardComment: failed to recover trello credentials: ${err}`
      );
    }

    // POST card comment to Trello
    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/cards/${trelloCardId}/actions/comments?key=${apikey}&token=${authToken}&text=${encodeURIComponent(
          text
        )}`,
        {
          responseType: 'json',
          method: 'POST',
        }
      );
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} POST card: ${trelloCardId} comment to trello API failed: ${err}`
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
   * PUT request to trello API
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} trelloCardId
   * @param  {Object} updates
   * @return {Promise}
   */
  async updateTrelloCard(
    db,
    propertyId,
    deficientItemId,
    trelloCardId,
    updates = {}
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
      `${PREFIX} has Trello Card id`
    );
    assert(
      typeof updates === 'object' && Object.keys(updates).length,
      `${PREFIX} has updates hash`
    );

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
        `${PREFIX} updateTrelloCard: failed to recover trello credentials: ${err}`
      );
    }

    let trelloUpdateUrl = `https://api.trello.com/1/cards/${trelloCardId}?key=${apikey}&token=${authToken}`;

    // Append updates to trello update URL
    // NOTE: added in alphabetical order for test suite
    Object.keys(updates)
      .sort()
      .forEach(param => {
        trelloUpdateUrl += `&${param}=${encodeURIComponent(updates[param])}`;
      });

    // PUT Trello card updates
    let response = null;
    try {
      response = await got(trelloUpdateUrl, {
        responseType: 'json',
        method: 'PUT',
        json: true,
      });
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} updateTrelloCard: PUT card: ${trelloCardId} via trello API failed: ${err}`
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
   * POST a Trello card attachment
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} trelloCardId
   * @param  {String} url
   * @return {Promise} - resolves {Object} Trello API response
   */
  async postTrelloCardAttachment(
    db,
    propertyId,
    deficientItemId,
    trelloCardId,
    url
  ) {
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      `${PREFIX} has Trello Card id`
    );
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item ID`
    );
    assert(typeof url === 'string', `${PREFIX} has attachment url`);

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
        `${PREFIX} postTrelloCardAttachment: failed to recover trello credentials: ${err}`
      );
    }

    // POST card comment to Trello
    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/cards/${trelloCardId}/attachments?key=${apikey}&token=${authToken}&url=${encodeURIComponent(
          url
        )}`,
        {
          responseType: 'json',
          method: 'POST',
          json: true,
        }
      );
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} POST attachment card: ${trelloCardId} request to trello API failed: ${err}`
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
});
