const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const archive = require('./_internal/archive');
const modelSetup = require('./utils/model-setup');
const config = require('../config');
const trello = require('../services/trello');

const PREFIX = 'models: system:';
const DEFICIENT_COLLECTION = config.deficientItems.collection;
const SYSTEM_COLLECTION = 'system';

module.exports = modelSetup({
  /**
   * Create or update a property trello object
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {Object} details
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  upsertPropertyTrello(db, propertyId, details, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(details && typeof details === 'object', 'has upsert object');
    assert(
      typeof details.cards === 'object',
      'has upsert object must contains a "cards" object'
    );

    if (batch) {
      assert(
        typeof batch.update === 'function' &&
          typeof batch.create === 'function',
        'has firestore batch'
      );
    }

    return db.runTransaction(async transaction => {
      const doc = db.collection(SYSTEM_COLLECTION).doc(`trello-${propertyId}`);

      let propertyTrelloRef = null;
      try {
        propertyTrelloRef = await transaction.get(doc);
      } catch (err) {
        throw Error(
          `${PREFIX} upsertPropertyTrello: failed to lookup existing property trello details: ${err}`
        );
      }

      const batchOrTrans = batch || transaction;
      const existingData = propertyTrelloRef.data() || {};
      const data = {
        ...existingData,
        ...{
          cards: {
            ...(existingData.cards || {}),
            ...details.cards,
          },
        },
      };

      if (propertyTrelloRef.exists) {
        batchOrTrans.update(doc, data);
      } else {
        batchOrTrans.create(doc, data);
      }

      if (batch) {
        return batch;
      }
    });
  },

  /**
   * Find any Trello Card ID associated with
   * a Deficient Item
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @return {Promise} - resolves {String} Trello card ID
   */
  async findTrelloCardId(db, propertyId, deficiencyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    // Lookup system credentials
    let propertyTrelloCards = null;
    try {
      const propertyTrelloCardsSnap = await db
        .collection(SYSTEM_COLLECTION)
        .doc(`trello-${propertyId}`)
        .get();
      propertyTrelloCards = (propertyTrelloCardsSnap.data() || {}).cards || {};
    } catch (err) {
      throw Error(
        `${PREFIX}: findTrelloCardId: failed to lookup property trello: ${err}`
      );
    }

    // Find any card reference stored for DI
    return (
      Object.keys(propertyTrelloCards).filter(
        id => propertyTrelloCards[id] === deficiencyId
      )[0] || ''
    );
  },

  /**
   * Check trello for deficient item card
   * and archive if exists
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {Boolean} archiving
   * @return {Promise} - resolves {Object} Trello API response
   */
  async archiveTrelloCard(db, propertyId, deficiencyId, archiving) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item id'
    );
    assert(typeof archiving === 'boolean', 'has archiving boolean');

    let trelloCardId = '';
    try {
      trelloCardId = await this.findTrelloCardId(db, propertyId, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} archiveTrelloCard: trello card lookup failed: ${err}`
      );
    }

    // DI has no Trello card to archive
    if (!trelloCardId) {
      return null;
    }

    // Lookup Trello credentials
    let apiKey = '';
    let authToken = '';
    try {
      const trelloCredentialsSnap = await this.findTrello(db);
      const trelloCredentials = trelloCredentialsSnap.data();
      if (!trelloCredentials) {
        throw Error('Organization has not authorized Trello');
      }
      apiKey = trelloCredentials.apikey;
      authToken = trelloCredentials.authToken;
    } catch (err) {
      throw Error(
        `${PREFIX} archiveTrelloCard: failed to recover trello credentials: ${err}`
      );
    }

    if (!apiKey || !authToken) {
      return null;
    }

    let response = null;
    try {
      response = await trello.archiveTrelloCard(
        trelloCardId,
        authToken,
        apiKey,
        archiving
      );
    } catch (err) {
      // Handle Deleted Trello card
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await this.cleanupDeletedTrelloCard(db, deficiencyId, trelloCardId);
        } catch (cleanUpErr) {
          err.message += ` ${cleanUpErr}`; // append to primary error
        }
      }

      throw err;
    }

    return response;
  },

  /**
   * Cleanup Trello Attributes of
   * Deficient Item or Archived Record
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {String} cardId
   * @return {Promise}
   */
  async cleanupDeletedTrelloCard(db, deficiencyId, cardId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item ID'
    );
    assert(cardId && typeof cardId === 'string', 'has card ID');

    // Lookup Active Record
    let deficiency = null;
    let isActive = false;
    let isArchived = false;

    try {
      const diDoc = await db
        .collection(DEFICIENT_COLLECTION)
        .doc(deficiencyId)
        .get();
      isActive = Boolean(diDoc && diDoc.exists);
      if (isActive) deficiency = diDoc.data();
    } catch (err) {
      throw Error(
        `${PREFIX} cleanupDeletedTrelloCard: firestore DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    // Lookup Archived Record
    if (!isActive) {
      try {
        const diDoc = await archive.deficientItem.findRecord(db, deficiencyId);
        isArchived = Boolean(diDoc && diDoc.exists);
        if (isArchived) deficiency = diDoc.data();
      } catch (err) {
        throw Error(
          `${PREFIX} cleanupDeletedTrelloCard: firestore archived DI "${deficiencyId}" lookup failed: ${err}`
        );
      }
    }

    // Firestore record does not exist
    if (!isActive && !isArchived) {
      return;
    }

    const batch = db.batch();
    const propertyId = deficiency.property;
    assert(
      propertyId && typeof propertyId === 'string',
      'has deficiency property id'
    );

    // Remove the Trello card reference from property integration
    try {
      const propertyTrelloCardsDoc = await db
        .collection(SYSTEM_COLLECTION)
        .doc(`trello-${propertyId}`);
      batch.update(propertyTrelloCardsDoc, {
        [`cards.${cardId}`]: FieldValue.delete(),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} cleanupDeletedTrelloCard: failed to remove card reference from system: ${err}`
      );
    }

    const updates = {};

    // Remove DI's Trello Card link
    if (deficiency.trelloCardURL) {
      updates.trelloCardURL = FieldValue.delete();
    }

    // Remove any Trello Card Attachment
    // references from the completed photos
    Object.keys(deficiency.completedPhotos || {}).forEach(id => {
      const photo = deficiency.completedPhotos[id];
      if (photo && photo.trelloCardAttachement) {
        updates[
          `completedPhotos.${id}.trelloCardAttachement`
        ] = FieldValue.delete();
      }
    });

    if (isActive) {
      const activeDeficiencyDoc = db
        .collection(DEFICIENT_COLLECTION)
        .doc(deficiencyId);
      batch.update(activeDeficiencyDoc, { ...updates });
    }

    if (isArchived) {
      try {
        await archive.deficientItem.updateRecord(
          db,
          deficiencyId,
          { ...updates },
          batch
        );
      } catch (err) {
        throw Error(
          `${PREFIX} cleanupDeletedTrelloCard: firestore archive update DI failed: ${err}`
        );
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      throw Error(
        `${PREFIX} cleanupDeletedTrelloCard: failed to commit writes: ${err}`
      );
    }
  },

  /**
   * Create or update an organization's Slack
   * API credentials for Sparkle/Slack integrations
   * @param  {admin.firestore} db
   * @param  {Object} credentials
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  upsertSlack(db, credentials, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(
      credentials && typeof credentials === 'object',
      'has credentials object'
    );
    if (credentials.token) {
      assert(typeof credentials.token === 'string', 'has token string');
    }
    if (credentials.accessToken) {
      assert(
        typeof credentials.accessToken === 'string',
        'has access token string'
      );
    }
    assert(credentials.accessToken || credentials.token, 'has access or token');

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

    return db.runTransaction(async transaction => {
      const slackCredentialsDoc = db.collection(SYSTEM_COLLECTION).doc('slack');

      let slackCredentialsRef = null;
      try {
        slackCredentialsRef = await transaction.get(slackCredentialsDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} upsertSlackAppCredentials: failed to lookup existing Slack credentials`
        );
      }

      const batchOrTrans = batch || transaction;
      const now = Math.round(Date.now() / 1000);
      const data = {
        scope: credentials.scope,
        accessToken: credentials.token || credentials.accessToken,
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
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findSlack(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('slack')
      .get();
  },

  /**
   * Remove system's slack credentials
   * @param  {admin.firestore} db
   * @param  {firstore.batch?} batch
   * @return {Promise}
   */
  removeSlack(db, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    const doc = db.collection(SYSTEM_COLLECTION).doc('slack');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Create or update an organization's Trello
   * API credentials for Sparkle/Trello integrations
   * @param  {admin.firestore} db
   * @param  {Object} credentials
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  upsertTrello(db, credentials, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
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

    return db.runTransaction(async transaction => {
      const trelloCredentialsDoc = db
        .collection(SYSTEM_COLLECTION)
        .doc('trello');

      let trelloCredentialsRef = null;
      try {
        trelloCredentialsRef = await transaction.get(trelloCredentialsDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} upsertTrelloCredentials: failed to lookup existing trello credentials`
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
   * Remove Firestore Trello credentials
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {firstore.batch?} batch
   * @return {Promise} - resolves {Document}
   */
  removeTrello(db, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }

    const doc = db.collection(SYSTEM_COLLECTION).doc('trello');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve(doc);
    }

    return doc.delete();
  },

  /**
   * Create a property's Trello integration record
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {Object} credentials
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  createTrelloProperty(db, propertyId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc(`trello-${propertyId}`)
      .create(data);
  },

  /**
   * Lookup a Property's Trello cards
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findTrelloProperty(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc(`trello-${propertyId}`)
      .get();
  },

  /**
   * Lookup Trello system credentials
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findTrello(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('trello')
      .get();
  },

  /**
   * Lookup all Property Trello Integrations
   * @param  {admin.firestore} db
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {Documents[]}
   */
  async findAllTrelloProperties(db, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (transaction) {
      assert(typeof transaction.get === 'function', 'has firestore batch');
    }

    const trelloPropertyDocs = [];
    const integrationDocs = db.collection(SYSTEM_COLLECTION);

    try {
      const request = transaction
        ? transaction.get(integrationDocs)
        : integrationDocs.get();
      const integrationsSnap = await request;

      // Push Trello property
      // integrations to array
      integrationsSnap.docs
        .filter(({ id }) => id.search(/^trello-/) === 0)
        .forEach(docSnap => trelloPropertyDocs.push(docSnap));
    } catch (err) {
      throw Error(
        `${PREFIX} findAllTrelloProperties: failed to lookup all integration properties: ${err}`
      );
    }

    return trelloPropertyDocs;
  },

  /**
   * Remove all Property/Trello integrations
   * @param  {admin.firestore} db
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Document[]}
   */
  removeAllTrelloProperties(db, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }

    return db.runTransaction(async transaction => {
      const integrationDocs = db.collection(SYSTEM_COLLECTION);

      let trelloPropertyDocs = null;
      try {
        trelloPropertyDocs = await this.findAllTrelloProperties(
          db,
          transaction
        );
      } catch (err) {
        throw Error(
          `${PREFIX} removeAllTrelloProperties: failed lookup: ${err}`
        );
      }

      const batchOrTrans = batch || transaction;
      trelloPropertyDocs.forEach(doc => batchOrTrans.delete(doc.ref));

      return integrationDocs;
    });
  },

  /**
   * Create Firestore Yardi Credentials
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createYardi(db, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('yardi')
      .create(data);
  },

  /**
   * Create Firestore Cobalt Credentials
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createCobalt(db, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('cobalt')
      .create(data);
  },

  /**
   * Lookup Yardi system credentials
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findYardi(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('yardi')
      .get();
  },

  /**
   * Lookup Cobalt system credentials
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findCobalt(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(SYSTEM_COLLECTION)
      .doc('cobalt')
      .get();
  },
});
