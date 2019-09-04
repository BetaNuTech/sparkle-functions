const got = require('got');
const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: integrations:';
const TRELLO_PROPERTIES_PATH = '/integrations/trello/properties';
const TRELLO_ORG_PATH = '/integrations/trello/organization';
const SLACK_ORG_PATH = '/integrations/slack/organization';

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
    return db.ref('/notifications/slack').once('value');
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
   * @return {Promise}
   */
  getSlackOrganization(db) {
    return db.ref(SLACK_ORG_PATH).once('value');
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
});
