const got = require('got');
const assert = require('assert');
const integrationsModel = require('../models/integrations');
const systemModel = require('../models/system');
const config = require('../config');

const PREFIX = 'services: slack:';
const SLACK_APP_CLIENT_ID = config.slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = config.slackApp.clientSecret;

module.exports = {
  /**
   * Send a notification message to a
   * previously authorized Slack channel
   * @param  {String} accessToken
   * @param  {String} channelName
   * @param  {String} message
   * @param  {String?} title
   * @return {Promise} - resolve {Object} API response body
   */
  async sendSlackChannelMessage(accessToken, channelName, message, title) {
    assert(accessToken && typeof accessToken === 'string', 'has access token');
    assert(channelName && typeof channelName === 'string', 'has channel name');
    assert(message && typeof message === 'string', 'has notification message');
    if (title) assert(typeof title === 'string', 'has notification title');

    const slackMessage = createSlackMessage(title || '', message);
    const queryParams = `?token=${accessToken}&channel=${channelName}&text=${encodeURIComponent(
      slackMessage
    )}`;

    let result = null;

    try {
      const response = await got(
        `https://slack.com/api/chat.postMessage${queryParams}`,
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
        throw Error(`${respErrMsg || 'Unknown API Error'}`);
      }

      result = response.body;
    } catch (err) {
      throw Error(`${PREFIX} API request failed: ${err}`);
    }

    return result;
  },

  /**
   * Clear database from all references to uninstalled slack app
   * NOTE: DEPRECATED: Delete when Firebase Db dropped
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @returns {Promise} - resolve {void}
   */
  async clearDatabaseFromSlackReferences(db) {
    assert(Boolean(db), 'has database instance');

    // Destroy system's private auth token
    try {
      await systemModel.destroySlackCredentials(db);
    } catch (err) {
      throw new Error(`${PREFIX} destroy slack credentials failed | ${err}`);
    }

    // Delete Slack Organization data
    try {
      await integrationsModel.destroySlackOrganization(db);
    } catch (err) {
      throw new Error(`${PREFIX} destroy slack organization failed | ${err}`);
    }

    // Delete all slack notifications
    try {
      await integrationsModel.destroySlackNotifications(db);
    } catch (err) {
      throw new Error(`${PREFIX} deleting notifications failed | ${err}`);
    }
  },

  /**
   * Authorize a slack code and redirect to get
   * system's access token & slack team details
   * @param  {String}  slackCode
   * @param  {String}  redirectUri
   * @return {Promise} - resolves {Object} response body
   */
  async authorizeCredentials(slackCode, redirectUri) {
    assert(slackCode && typeof slackCode === 'string', 'has slack code string');
    assert(
      redirectUri && typeof redirectUri === 'string',
      'has redirect URI string'
    );

    const queryParams = `?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${slackCode}&redirect_uri=${redirectUri}`;
    const response = await got(
      `https://slack.com/api/oauth.access${queryParams}`,
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
      throw Error(respErrMsg || 'Unknown Slack API error');
    }

    return response.body;
  },

  /**
   * Remove a slack app from a workspace
   * @param  {String}  accessToken
   * @return {Promise}
   */
  async uninstallApp(accessToken) {
    assert(accessToken && typeof accessToken === 'string', 'has access token');

    const queryParams = `?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${accessToken}`;
    const response = await got(
      `https://slack.com/api/apps.uninstall${queryParams}`,
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        responseType: 'json',
        method: 'GET',
        json: true,
      }
    );

    if (!response || !response.body || !response.body.ok) {
      const respErrMsg = response && response.body && response.body.error;
      throw Error(respErrMsg || 'Unknown Slack API error');
    }
  },

  /**
   * Request to join a Slack channel
   * @param   {String} accessToken
   * @param   {String} channelName
   * @returns {Promise} - resolves {Object} response body
   */
  async joinChannel(accessToken, channelName) {
    assert(accessToken && typeof accessToken === 'string', 'has access token');
    assert(channelName && typeof channelName === 'string', 'has channel name');

    let response = null;
    try {
      response = await got(
        `https://slack.com/api/channels.join?token=${accessToken}&name=${channelName}&validate=true`,
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
          `Slack API Request failed: ${respErrMsg || 'Unknown Error'}`
        );
      }
    } catch (err) {
      throw Error(`${PREFIX} joinChannel: ${err}`); // wrap error
    }

    return response.body;
  },
};

/**
 * Configure a rich text Slack message
 * @param  {String?} title
 * @param  {String} message
 * @return {String} - interpolated Slack message
 */
function createSlackMessage(title, message) {
  let result = '';

  if (title) {
    result = `*${title}*

`;
  }

  return `${result}${message}`;
}
