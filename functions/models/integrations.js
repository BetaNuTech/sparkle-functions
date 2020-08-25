const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';
const INTEGRATIONS_COLLECTION = 'integrations';
const CLIENT_APPS_COLLECTION = '/clients';

module.exports = modelSetup({
  /**
   * Get all client app documents
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  getClientApps(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(CLIENT_APPS_COLLECTION).get();
  },

  /**
   * Set/replace Slacks integration details
   * @param  {admin.firestore} fs
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Object} integration data
   */
  firestoreSetSlack(fs, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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

    const doc = fs.collection(INTEGRATIONS_COLLECTION).doc('slack');
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
   * Lookup Slack system credentials
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreFindSlack(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc('slack')
      .get();
  },

  /**
   * Update Firestore notification
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} notificationId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreUpdateSlack(fs, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has update data');
    if (batch) {
      assert(typeof batch.update === 'function', 'has firestore batch');
    }

    const doc = fs.collection(INTEGRATIONS_COLLECTION).doc('slack');

    if (batch) {
      batch.update(doc, data);
      return Promise.resolve(doc);
    }

    return doc.update(data);
  },

  /**
   * Is given Slack team ID integrated with system
   * @param  {admin.firestore}  fs
   * @param  {String}  teamId
   * @return {Promise} - resolves {Boolean}
   */
  async isAuthorizedSlackTeam(fs, teamId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    // Lookup firestore Slack integration
    let slackOrganization = null;
    try {
      const slackOrganizationSnap = await this.firestoreFindSlack(fs);
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
   * @param  {admin.firestore} fs
   * @param  {firstore.batch?} batch
   * @return {Promise}
   */
  firestoreRemoveSlack(fs, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    const doc = fs.collection(INTEGRATIONS_COLLECTION).doc('slack');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Create or update an organization's Trello
   * public details of Sparkle/Trello integration
   * @param  {admin.firestore} fs
   * @param  {Object} details
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Object} integration details
   */
  firestoreUpsertTrello(fs, details, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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

    return fs.runTransaction(async transaction => {
      const trelloDoc = fs.collection(INTEGRATIONS_COLLECTION).doc('trello');

      let trelloRef = null;
      try {
        trelloRef = await transaction.get(trelloDoc);
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreUpsertTrelloCredentials: failed to lookup existing trello credentials`
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
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot}
   */
  firestoreFindTrello(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc('trello')
      .get();
  },

  /**
   * Remove all Property/Trello integrations
   * @param  {admin.firestore} fs
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {Document[]}
   */
  firestoreRemoveAllTrelloProperties(fs, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }

    return fs.runTransaction(async transaction => {
      const integrationDocs = fs.collection(INTEGRATIONS_COLLECTION);

      let trelloPropertyDocs = null;
      try {
        trelloPropertyDocs = await this.firestoreFindAllTrelloProperties(
          fs,
          transaction
        );
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreRemoveAllTrelloProperties: failed lookup: ${err}`
        );
      }

      const batchOrTrans = batch || transaction;
      trelloPropertyDocs.forEach(doc => batchOrTrans.delete(doc.ref));

      return integrationDocs;
    });
  },

  /**
   * Remove Firestore Trello integration
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {firstore.batch?} batch
   * @return {Promise} - resolves {Document}
   */
  firestoreRemoveTrello(fs, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (batch) {
      assert(typeof batch.delete === 'function', 'has firestore batch');
    }

    const doc = fs.collection(INTEGRATIONS_COLLECTION).doc('trello');

    if (batch) {
      batch.delete(doc);
      return Promise.resolve(doc);
    }

    return doc.delete();
  },

  /**
   * Lookup all Property Trello Integrations
   * @param  {admin.firestore} fs
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {Documents[]}
   */
  async firestoreFindAllTrelloProperties(fs, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (transaction) {
      assert(typeof transaction.get === 'function', 'has firestore batch');
    }

    const trelloPropertyDocs = [];
    const integrationDocs = fs.collection(INTEGRATIONS_COLLECTION);

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
        `${PREFIX} firestoreFindAllTrelloProperties: failed to lookup all integration properties: ${err}`
      );
    }

    return trelloPropertyDocs;
  },

  /**
   * Create a Firestore Trello Organization
   * @param  {admin.firestore} fs
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateTrello(fs, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc('trello')
      .create(data);
  },

  /**
   * Create a Firestore Yardi Organization
   * @param  {admin.firestore} fs
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateYardi(fs, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc('yardi')
      .create(data);
  },

  /**
   * Create a Firestore Cobalt Organization
   * @param  {admin.firestore} fs
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateCobalt(fs, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc('cobalt')
      .create(data);
  },

  /**
   * Create a property Trello integration
   * @param  {admin.firestore} fs
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise}
   */
  firestoreCreateTrelloProperty(fs, propertyId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data object');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`)
      .create(data);
  },

  /**
   * Lookup a property Trello integration
   * @param  {admin.firestore} fs
   * @param  {String} propertyId
   * @return {Promise}
   */
  firestoreFindTrelloProperty(fs, propertyId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    return fs
      .collection(INTEGRATIONS_COLLECTION)
      .doc(`trello-${propertyId}`)
      .get();
  },
});
