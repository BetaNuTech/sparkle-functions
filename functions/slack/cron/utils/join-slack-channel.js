const got = require('got');

const PREFIX = 'slack: cron: utils: join-slack-channel:';

/**
 * This function is used to attempt to join slack channels
 * @param   {String} accessToken This is the slack access token we have stored for this organization
 * @param   {String} channelName This is the channel we are attempting to join
 * @returns {Promise} - Resolve {String} this is the body response from the slack api from joining a channel
 */
module.exports = async function joinSlackChannel(accessToken, channelName) {
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
        `${PREFIX} error joining slack channel: ${respErrMsg ||
          'Unknown Error'}`
      ); // wrap error
    }

    return response.body;
  } catch (err) {
    throw Error(`${PREFIX} ${err}`);
  }
};
