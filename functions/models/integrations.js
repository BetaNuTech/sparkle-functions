const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';
const INTEGRATIONS_COLLECTION = 'integrations';
const CLIENT_APPS_COLLECTION = '/clients';

module.exports = modelSetup({
  /**
   * Get all client app documents
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  getClientApps(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(CLIENT_APPS_COLLECTION).get();
  },

  /**
   * Set/replace Slacks integration details
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Object} integration data
   */
  setSlack(db, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data object');
    assert(
      data.grantedBy && typeof data.grantedBy === 'string',
      'has granted by string'
    );
    assert(data.team && typeof data.team === 'string', 'has slack team id');
    assert(
      data.teamName && typeof data.teamName === 'string',
      'has slack team name'
    );
    if (batch) {
      assert(typeof batch.set === 'function', 'has firestore batch');
    }

    const doc = db.collection(INTEGRATIONS_COLLECTION).doc('slack');
    const integrationData = {
      createdAt: data.createdAt || Math.round(Date.now() / 1000),
      ...data,
    };

    // Append to batch
    if (batch) {
      batch.set(doc, integrationData);
      return Promise.resolve(integrationData);
    }

    // Regular set
    return doc.set(integrationData);
  },

  /**
   * Lookup Slack integration details
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findSlack(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('slack')
      .get();
  },

  /**
   * Lookup Slack integration details
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findYardi(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('yardi')
      .get();
  },

  /**
   * Update Firestore slack integration details
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  updateSlack(db, data, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = db.collection(INTEGRATIONS_COLLECTION).doc('slack');

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Is given Slack team ID integrated with system
   * @param  {admin.firestore} db
   * @param  {String}  teamId
   * @return {Promise} - resolves {Boolean}
   */
  async isAuthorizedSlackTeam(db, teamId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    // Lookup firestore Slack integration
    let slackOrganization = null;
    try {
      const slackOrganizationSnap = await this.findSlack(db);
      if (slackOrganizationSnap.data()) {
        slackOrganization = slackOrganizationSnap.data();
      }
    } catch (err) {
      throw Error(
        `${PREFIX} isOrganizationsTeam: Firestore lookup failed: ${err}`
      );
    }

    return Boolean(slackOrganization && slackOrganization.team === teamId);
  },

  /**
   * Remove slack integration details
   * @param  {admin.firestore} db
   * @param  {firstore.batch?} batch
   * @return {Promise}
   */
  removeSlack(db, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    const doc = db.collection(INTEGRATIONS_COLLECTION).doc('slack');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Create or update an organization's Trello
   * public details of Sparkle/Trello integration
   * @param  {admin.firestore} db
   * @param  {Object} details
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Object} integration details
   */
  upsertTrello(db, details, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(details && typeof details === 'object', 'has details object');
    assert(
      details.member && typeof details.member === 'string',
      'has trello member ID'
    );
    assert(
      details.trelloUsername && typeof details.trelloUsername === 'string',
      'has trello username'
    );

    if (details.trelloEmail) {
      assert(
        typeof details.trelloEmail === 'string',
        'has trello member email string'
      );
    }

    if (details.trelloFullName) {
      assert(
        typeof details.trelloFullName === 'string',
        'has trello member full name string'
      );
    }

    if (batch) {
      assert(
        typeof batch.update === 'function' &&
          typeof batch.create === 'function',
        'has firestore batch'
      );
    }

    return db.runTransaction(async transaction => {
      const trelloDoc = db.collection(INTEGRATIONS_COLLECTION).doc('trello');

      let trelloRef = null;
      try {
        trelloRef = await transaction.get(trelloDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} upsertTrelloCredentials: failed to lookup existing trello credentials`
        );
      }

      const batchOrTrans = batch || transaction;
      const now = Math.round(Date.now() / 1000);
      const data = {
        member: details.member,
        trelloUsername: details.trelloUsername,
        updatedAt: now,
      };
      if (details.trelloEmail) data.trelloEmail = details.trelloEmail;
      if (details.trelloFullName) data.trelloFullName = details.trelloFullName;

      if (trelloRef.exists) {
        batchOrTrans.update(trelloDoc, data);
      } else {
        data.createdAt = now;
        batchOrTrans.create(trelloDoc, data);
      }

      return data;
    });
  },

  /**
   * Lookup Trello system credentials
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  findTrello(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('trello')
      .get();
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
      const integrationDocs = db.collection(INTEGRATIONS_COLLECTION);

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
   * Remove Firestore Trello integration
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {firstore.batch?} batch
   * @return {Promise} - resolves {Document}
   */
  removeTrello(db, batch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }

    const doc = db.collection(INTEGRATIONS_COLLECTION).doc('trello');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve(doc);
    }

    return doc.delete();
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
    const integrationDocs = db.collection(INTEGRATIONS_COLLECTION);

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
   * Create a Firestore Trello Organization
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createTrello(db, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('trello')
      .create(data);
  },

  /**
   * Create a Firestore Yardi Organization
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createYardi(db, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('yardi')
      .create(data);
  },

  /**
   * Create a Firestore Cobalt Organization
   * @param  {admin.firestore} db
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createCobalt(db, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc('cobalt')
      .create(data);
  },

  /**
   * Create a property Trello integration
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise}
   */
  createTrelloProperty(db, propertyId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data object');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`)
      .create(data);
  },

  /**
   * Remove Firestore Property Trello Integration
   * @param  {admin.firestore} db - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise}
   */
  removeTrelloProperty(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`)
      .delete();
  },

  /**
   * Set (create/update) Firestore Property
   * Trello Integration
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @param  {Boolean?} merge - deep merge record
   * @return {Promise}
   */
  setTrelloPropertyRecord(db, propertyId, data, batch, merge = false) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data payload');

    const docRef = db
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`);

    // Add batched update
    if (batch) {
      assert(
        typeof batch.set === 'function' && typeof batch.update === 'function',
        'has batch instance'
      );
      batch.set(docRef, data, { merge });
      return Promise.resolve();
    }

    // Normal update
    return docRef.set(data, { merge });
  },

  /**
   * Lookup a property Trello integration
   * @param  {admin.firestore} db
   * @param  {String} propertyId
   * @return {Promise}
   */
  findTrelloProperty(db, propertyId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return db
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`)
      .get();
  },
});
