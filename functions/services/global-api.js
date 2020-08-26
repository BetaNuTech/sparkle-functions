const got = require('got');
const assert = require('assert');
const { globalApi: globalApiConfig } = require('../config');

const PREFIX = 'services: global-api:';

module.exports = {
  /**
   * Add or remove a Slack Team ID
   * to the Global API to configure
   * it for Slack API events to this
   * (client) API
   * @param  {String}  slackTeamId
   * @return {Promise}
   */
  async updateSlackTeam(slackTeamId) {
    if (slackTeamId) {
      assert(typeof slackTeamId === 'string', 'has valid slack team');
    }

    try {
      const response = await got(
        `${globalApiConfig.domain}${globalApiConfig.patchSlackTeam}`,
        {
          headers: {
            authorization: `fb-jwt ${globalApiConfig.authToken}`,
          },
          responseType: 'json',
          method: 'PATCH',
          json: true,
        }
      );

      if (!response || !response.statusCode) {
        throw Error('Unexpected Global API response');
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errors = (response.body || {}).errors || [];
        const errMsg = (errors[0] || {}).detail || 'Unknown Error';
        throw Error(errMsg);
      }
    } catch (err) {
      throw Error(`${PREFIX} ${err}`);
    }
  },
};
