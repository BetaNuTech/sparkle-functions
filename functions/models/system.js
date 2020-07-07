const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const got = require('got');
const archive = require('./_internal/archive');
const modelSetup = require('./utils/model-setup');
const config = require('../config');

const PREFIX = 'models: system:';
const SERVICE_ACCOUNT_CLIENT_ID =
  config.firebase.databaseAuthVariableOverride.uid;
const DI_DATABASE_PATH = config.deficientItems.dbPath;
const DEFICIENT_COLLECTION = config.deficientItems.collection;
const SYSTEM_COLLECTION = 'system';
const TRELLO_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/trello/organization`;
const YARDI_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/yardi/organization`;
const COBALT_ORG_PATH = `/system/integrations/${SERVICE_ACCOUNT_CLIENT_ID}/cobalt/organization`;
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
   * Lookup Yardi credentials
   * @param  {firebaseAdmin.database} db - firbase database
   * @return {Promise} - resolves {DataSnapshot}
   */
  findYardiCredentials(db) {
    return db.ref(YARDI_ORG_PATH).once('value');
  },

  /**
   * Lookup Cobalt credentials
   * @param  {firebaseAdmin.database} db - firbase database
   * @return {Promise} - resolves {DataSnapshot}
   */
  findCobaltCredentials(db) {
    return db.ref(COBALT_ORG_PATH).once('value');
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
   * @param  {admin.database} db
   * @param  {admin.firestore} fs
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {Boolean} archiving if the trello card should be archived or unarchived
   * @return {Promise} - resolves {Object} Trello API response
   */
  async archiveTrelloCard(db, fs, propertyId, deficientItemId, archiving) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(typeof archiving === 'boolean', 'has archiving boolean');

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

          await this._firestoreCleanupDeletedTrelloCard(fs, deficientItemId);
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
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item ID'
    );
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      'has Trello card ID'
    );

    // Remove the Trello card reference from property integration
    try {
      await db
        .ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}/cards/${trelloCardId}`)
        .remove();
    } catch (err) {
      throw Error(
        `${PREFIX} error removing card from trello integration path: ${err}`
      );
    }

    // Remove any Trello card URL's on DI's
    try {
      await db.ref().update({
        [`${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/trelloCardURL`]: null,
        [`archive${DI_DATABASE_PATH}/${propertyId}/${deficientItemId}/trelloCardURL`]: null,
      });
    } catch (err) {
      throw Error(`${PREFIX} error removing Trello card URL from DI: ${err}`);
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
        `${PREFIX} error removing Trello attachment ID from DI completed photos: ${err}`
      );
    }
  },

  /**
   * Cleanup Trello Attributes of
   * Deficient Item or Archived Record
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  async _firestoreCleanupDeletedTrelloCard(fs, deficiencyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item ID'
    );

    // Lookup Active Record
    let deficientItem = null;
    let isActive = false;
    let isArchived = false;

    try {
      const diDoc = await fs
        .collection(DEFICIENT_COLLECTION)
        .doc(deficiencyId)
        .get();
      isActive = Boolean(diDoc && diDoc.exists);
      if (isActive) deficientItem = diDoc.data();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    // Lookup Archived Record
    if (!isActive) {
      try {
        const diDoc = await archive.deficientItem.firestoreFindRecord(
          fs,
          deficiencyId
        );
        isArchived = Boolean(diDoc && diDoc.exists);
        if (isArchived) deficientItem = diDoc.data();
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore archived DI "${deficiencyId}" lookup failed: ${err}`
        );
      }
    }

    // Firestore record does not exist
    if (!isActive && !isArchived) {
      return;
    }

    const updates = {};

    // Remove DI's Trello Card link
    if (deficientItem.trelloCardURL) {
      updates.trelloCardURL = FieldValue.delete();
    }

    // Remove any Trello Card Attachment references
    // from the completed photos of the DI
    Object.keys(deficientItem.completedPhotos || {}).forEach(id => {
      const photo = deficientItem.completedPhotos[id];
      if (photo && photo.trelloCardAttachement) {
        updates.completedPhotos = updates.completedPhotos || {};
        updates.completedPhotos[id] = {
          ...photo,
          trelloCardAttachement: FieldValue.delete(),
        };
      }
    });

    if (isActive) {
      try {
        await fs
          .collection(DEFICIENT_COLLECTION)
          .doc(deficiencyId)
          .update({
            ...deficientItem,
            ...updates,
          });
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore update DI failed: ${err}`
        );
      }
    }

    if (isArchived) {
      try {
        await archive.deficientItem.firestoreUpdateRecord(fs, deficiencyId, {
          ...deficientItem,
          ...updates,
        });
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore archive update DI failed: ${err}`
        );
      }
    }
  },

  /**
   * POST a Trello card comment
   * @param  {admin.database} db
   * @param  {admin.firebase} fs
   * @param  {String}  propertyId
   * @param  {String}  deficientItemId
   * @param  {String}  trelloCardId
   * @param  {String}  text
   * @return {Promise} - resolves {Object} Trello API response
   */
  async postTrelloCardComment(
    db,
    fs,
    propertyId,
    deficientItemId,
    trelloCardId,
    text
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item ID'
    );
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      'has Trello Card id'
    );
    assert(text && typeof text === 'string', 'has comment text');

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

          await this._firestoreCleanupDeletedTrelloCard(fs, deficientItemId);
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
   * @param  {admin.database} db
   * @param  {admin.firestore} fs
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} trelloCardId
   * @param  {Object} updates
   * @return {Promise}
   */
  async updateTrelloCard(
    db,
    fs,
    propertyId,
    deficientItemId,
    trelloCardId,
    updates = {}
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item ID'
    );
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      'has Trello Card id'
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

          await this._firestoreCleanupDeletedTrelloCard(fs, deficientItemId);
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
   * @param  {admin.database} db
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} trelloCardId
   * @param  {String} url
   * @return {Promise} - resolves {Object} Trello API response
   */
  async postTrelloCardAttachment(
    db,
    fs,
    propertyId,
    deficientItemId,
    trelloCardId,
    url
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      trelloCardId && typeof trelloCardId === 'string',
      'has Trello Card id'
    );
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item ID'
    );
    assert(typeof url === 'string', 'has attachment url');

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

          await this._firestoreCleanupDeletedTrelloCard(fs, deficientItemId);
        } catch (cleanUpErr) {
          resultErr.message += `${cleanUpErr}`; // append to primary error
        }
      }

      throw resultErr;
    }

    return response;
  },

  /**
   * Create or update an organization's Slack
   * API credentials for Sparkle/Slack integrations
   * @param  {admin.firestore} fs
   * @param  {Object} credentials
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreUpsertSlack(fs, credentials, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      credentials && typeof credentials === 'object',
      'has credentials object'
    );
    assert(
      credentials.token && typeof credentials.token === 'string',
      'has token'
    );
    assert(
      credentials.scope && typeof credentials.scope === 'string',
      'has scope'
    );
    if (batch) {
      assert(
        typeof batch.update === 'function' &&
          typeof batch.create === 'function',
        'has firestore batch'
      );
    }

    return fs.runTransaction(async transaction => {
      const slackCredentialsDoc = fs.collection(SYSTEM_COLLECTION).doc('slack');

      let slackCredentialsRef = null;
      try {
        slackCredentialsRef = await transaction.get(slackCredentialsDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreUpsertSlackAppCredentials: failed to lookup existing Slack credentials`
        );
      }

      const batchOrTrans = batch || transaction;
      const now = Math.round(Date.now() / 1000);
      const data = {
        scope: credentials.scope,
        accessToken: credentials.token,
        updatedAt: now,
      };

      if (slackCredentialsRef.exists) {
        batchOrTrans.update(slackCredentialsDoc, data);
      } else {
        data.createdAt = now;
        batchOrTrans.create(slackCredentialsDoc, data);
      }

      if (batch) {
        return batch;
      }
    });
  },

  /**
   * Lookup Slack system credentials
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreFindSlack(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs
      .collection(SYSTEM_COLLECTION)
      .doc('slack')
      .get();
  },

  /**
   * Remove system's slack credentials
   * @param  {admin.firestore} fs
   * @param  {firstore.batch?} batch
   * @return {Promise}
   */
  firestoreRemoveSlack(fs, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    const doc = fs.collection(SYSTEM_COLLECTION).doc('slack');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Create or update an organization's Trello
   * API credentials for Sparkle/Trello integrations
   * @param  {admin.firestore} fs
   * @param  {Object} credentials
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreUpsertTrello(fs, credentials, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      credentials && typeof credentials === 'object',
      'has credentials object'
    );
    assert(
      credentials.authToken && typeof credentials.authToken === 'string',
      'has token'
    );
    assert(
      credentials.apikey && typeof credentials.apikey === 'string',
      'has api key'
    );
    assert(
      credentials.user && typeof credentials.user === 'string',
      'has firebase user ID'
    );
    if (batch) {
      assert(
        typeof batch.update === 'function' &&
          typeof batch.create === 'function',
        'has firestore batch'
      );
    }

    return fs.runTransaction(async transaction => {
      const trelloCredentialsDoc = fs
        .collection(SYSTEM_COLLECTION)
        .doc('trello');

      let trelloCredentialsRef = null;
      try {
        trelloCredentialsRef = await transaction.get(trelloCredentialsDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreUpsertTrelloCredentials: failed to lookup existing trello credentials`
        );
      }

      const batchOrTrans = batch || transaction;
      const now = Math.round(Date.now() / 1000);
      const data = {
        user: credentials.user,
        apikey: credentials.apikey,
        authToken: credentials.authToken,
        updatedAt: now,
      };

      if (trelloCredentialsRef.exists) {
        batchOrTrans.update(trelloCredentialsDoc, data);
      } else {
        data.createdAt = now;
        batchOrTrans.create(trelloCredentialsDoc, data);
      }

      return trelloCredentialsDoc;
    });
  },

  /**
   * Lookup Trello system credentials
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreFindTrello(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs
      .collection(SYSTEM_COLLECTION)
      .doc('trello')
      .get();
  },
});
