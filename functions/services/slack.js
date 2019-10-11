const got = require('got');
const assert = require('assert');

const PREFIX = 'services: slack:';

module.exports = {
  /**
   * Send a notification message to a
   * previously authorized Slack channel
   * @param  {String} accessToken
   * @param  {String} channelName
   * @param  {String} title
   * @param  {String} message
   * @return {Promise} - resolve {Object} API response body
   */
  async sendSlackChannelMessage(accessToken, channelName, title, message) {
    assert(accessToken && typeof accessToken === 'string', 'has access token');
    assert(channelName && typeof channelName === 'string', 'has channel name');
    assert(title && typeof title === 'string', 'has notification title');
    assert(message && typeof message === 'string', 'has notification message');

    const slackMessage = createSlackMessage(title, message);
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
};

/**
 * Configure a rich text Slack message
 * @param  {String} title
 * @param  {String} message
 * @return {String} - interpolated Slack message
 */
function createSlackMessage(title, message) {
  return `*${title}*

${message}`;
}
