const got = require('got');
const assert = require('assert');

const PREFIX = 'services: slack:';
const integrationsModel = require('../models/integrations');
const systemModel = require('../models/system');

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
   * Handle app uninstalled event
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {teamId} String - slack team identifier
   * @returns {Promise} - returns {Boolean} success
   */
  async handleAppUninstalledEvent(db, teamId) {
    assert(Boolean(db), 'has database instance');
    assert(teamId && typeof teamId === 'string', 'has team id');

    const slackOrganization =
      (await integrationsModel.getSlackOrganization(db)).val() || {};

    if (slackOrganization.team !== teamId) {
      throw new Error(
        `${PREFIX} app_uninstalled for wrong team, wanted: "${slackOrganization.team}" got: "${teamId}"`
      );
    }

    return this.clearDatabaseFromSlackReferences(db);
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
