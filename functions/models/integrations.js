const got = require('got');
const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';
const INTEGRATIONS_COLLECTION = 'integrations';
const TRELLO_PROPERTIES_PATH = '/integrations/trello/properties';
const TRELLO_ORG_PATH = '/integrations/trello/organization';
const SLACK_ORG_PATH = '/integrations/slack/organization';
const SLACK_NOTIFICATION_PATH = '/notifications/slack';
const CLIENT_APPS_COLLECTION = '/clients';

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
    return db.ref(`${TRELLO_PROPERTIES_PATH}/${propertyId}`).once('value');
  },

  /**
   * Archive all Trello property integrations
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resovles {DataSnapshot} property integrations snapshot
   */
  async archiveAllPropertyTrelloConfigs(db) {
    // Lookup all trello property integrations
    let propertyConfigsSnap = null;
    try {
      propertyConfigsSnap = await db.ref(TRELLO_PROPERTIES_PATH).once('value');
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: integrations lookup failed`
      );
    }

    // No updates needed
    if (!propertyConfigsSnap.exists()) {
      return null;
    }

    // Move trello integrations into archive
    try {
      await db
        .ref(`/archive${TRELLO_PROPERTIES_PATH}`)
        .set(propertyConfigsSnap.val());
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: archive write failed`
      );
    }

    // Destroy integrations for all properties
    try {
      await db.ref(TRELLO_PROPERTIES_PATH).remove();
    } catch (err) {
      throw Error(
        `${PREFIX} archiveAllPropertyTrelloConfigs: integrations deletion failed`
      );
    }

    return propertyConfigsSnap;
  },

  /**
   * Lookup all notifications for Slack
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot} notifications snapshot
   */
  findAllSlackNotifications(db) {
    return db.ref(SLACK_NOTIFICATION_PATH).once('value');
  },

  /**
   * Lookup all notifications by a Slack channel
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} channelName
   * @return {Promise} - resolves {DataSnapshot} notifications snapshot
   */
  findSlackNotificationsByChannel(db, channelName) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} has channel name`
    );

    return db.ref(`${SLACK_NOTIFICATION_PATH}/${channelName}`).once('value');
  },

  /**
   * Remove an individual Slack notification record
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} channelName
   * @param  {String} notificationId
   * @return {Promise} - resolves {DataSnapshot} notifications snapshot
   */
  removeSlackNotification(db, channelName, notificationId) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} has channel name`
    );
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} has notification ID`
    );
    return db
      .ref(`/notifications/slack/${channelName}/${notificationId}`)
      .remove();
  },

  /**
   * Add trello integration details
   * for the organization
   * @param {firebaseAdmin.database} db firbase database
   * @param {String} member
   * @param {String} trelloUsername
   * @param {String} trelloEmail
   * @param {String} trelloFullName
   * @return {Promise}
   */
  setTrelloOrganization(db, settings = {}) {
    const { member, trelloUsername, trelloEmail, trelloFullName } = settings;

    assert(
      member && typeof member === 'string',
      `${PREFIX} has Trello member id`
    );
    assert(
      trelloUsername && typeof trelloUsername === 'string',
      `${PREFIX} has Trello username`
    );
    assert(
      trelloEmail ? typeof trelloEmail === 'string' : true,
      `${PREFIX} has Trello email`
    );
    assert(
      trelloFullName ? typeof trelloFullName === 'string' : true,
      `${PREFIX} has Trello full name`
    );

    const unixNow = Math.round(Date.now() / 1000);

    const result = {
      createdAt: unixNow,
      updatedAt: unixNow,
      member,
      trelloUsername,
    };

    if (trelloEmail) {
      result.trelloEmail = trelloEmail;
    }

    if (trelloFullName) {
      result.trelloFullName = trelloFullName;
    }

    return db.ref(TRELLO_ORG_PATH).set(result);
  },

  /**
   * Set the public facing Slack organization's
   * integration details
   * @param  {firebaseAdmin.database} db - firbase database
   * @param  {Object} settings
   * @return {Promise}
   */
  setSlackOrganization(db, settings = {}) {
    const { createdAt, grantedBy, team, teamName } = Object.assign(
      { createdAt: Math.round(Date.now() / 1000) },
      settings
    );
    assert(
      grantedBy && typeof grantedBy === 'string',
      `${PREFIX} setSlackOrganization: has grantedBy user`
    );
    assert(
      team && typeof team === 'string',
      `${PREFIX} setSlackOrganization: has team reference`
    );
    assert(
      teamName && typeof teamName === 'string',
      `${PREFIX} setSlackOrganization: has team name`
    );

    return db.ref(SLACK_ORG_PATH).set({
      createdAt,
      grantedBy,
      team,
      teamName,
    });
  },

  /**
   * Get the public facing Slack organization details
   * @param  {firebaseAdmin.database} db - firbase database
   * @param  {Object} settings
   * @return {Promise} - resolves {DataSnapshot}
   */
  getSlackOrganization(db) {
    return db.ref(SLACK_ORG_PATH).once('value');
  },

  /**
   * Get the public facing Trello organization details
   * @param  {firebaseAdmin.database} db - firbase database
   * @param  {Object} settings
   * @return {Promise} - resolves {DataSnapshot}
   */
  getTrelloOrganization(db) {
    return db.ref(TRELLO_ORG_PATH).once('value');
  },

  /**
   * Remove trello integration details
   * for the organization
   * @param {firebaseAdmin.database} db firbase database
   * @return {Promise}
   */
  destroyTrelloOrganization(db) {
    return db.ref(TRELLO_ORG_PATH).remove();
  },

  /**
   * Remove Slack integration organization data
   * @param  {firebaseAdmin.database} db firebase database
   * @return {Promise}
   */
  destroySlackOrganization(db) {
    return db.ref(SLACK_ORG_PATH).remove();
  },

  /**
   * Remove Slack notifications
   * @param  {firebaseAdmin.database} db firebase database
   * @return {Promise}
   */
  destroySlackNotifications(db) {
    return db.ref(SLACK_NOTIFICATION_PATH).remove();
  },

  /**
   * Join specified Slack channel and
   * record success in integrations history
   * @param   {firebaseAdmin.database} db firbase database
   * @param   {String} accessToken
   * @param   {String} channelName
   * @returns {Promise} - Resolves {Object} Slack API's response body
   */
  async joinSlackChannel(db, accessToken, channelName) {
    let result = null;
    let alreadyInChannel = false;

    try {
      const queryParams = `?token=${accessToken}&name=${channelName}&validate=true`;
      const response = await got(
        `https://slack.com/api/channels.join${queryParams}`,
        {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          responseType: 'json',
          method: 'POST',
          json: true,
        }
      );

      if (!response || !response.body || !response.body.ok) {
        const respErrMsg = response && response.body && response.body.error;
        throw Error(
          `failed to join slack channel: ${respErrMsg || 'Unknown Error'}`
        ); // wrap error
      }

      result = response.body;

      if (result.already_in_channel) alreadyInChannel = true;
    } catch (err) {
      throw Error(`${PREFIX} joinSlackChannel: ${err}`);
    }

    // Set joined Slack channel history
    if (!alreadyInChannel) {
      try {
        const now = Math.round(Date.now() / 1000);
        await db
          .ref(`${SLACK_ORG_PATH}/joinedChannelNames/${channelName}`)
          .set(now);
      } catch (err) {
        throw Error(
          `${PREFIX} joinSlackChannel: failed to set join record ${err}`
        );
      }
    }

    return result;
  },

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
      createdAt: Math.round(Date.now() / 1000),
      grantedBy: data.grantedBy,
      team: data.team,
      teamName: data.teamName,
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
});
