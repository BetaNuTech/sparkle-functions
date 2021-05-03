const firebaseConfig = require('./firebase');
const log = require('../utils/logger');

const PREFIX = 'config: global-api:';
const GLOBAL_API_TOKEN =
  process.env.GLOBAL_API_TOKEN ||
  (firebaseConfig.globalApi && firebaseConfig.globalApi.token);

const GLOBAL_API_DOMAIN =
  process.env.GLOBAL_API_DOMAIN ||
  (firebaseConfig.globalApi && firebaseConfig.globalApi.domain);

if (!GLOBAL_API_TOKEN) {
  log.warn(`${PREFIX} missing environment variable: "GLOBAL_API_TOKEN"`);
}

if (!GLOBAL_API_DOMAIN) {
  log.warn(`${PREFIX} missing environment variable: "GLOBAL_API_DOMAIN"`);
}

module.exports = {
  /**
   * Domain name of Global API
   * @type {String}
   */
  domain: GLOBAL_API_DOMAIN,

  /**
   * Firebase user token
   * generated by Global Functions
   * authentication system
   * @type {String}
   */
  authToken: GLOBAL_API_TOKEN,

  /**
   * Path to PATCH Slack team
   * @return {String}
   */
  get patchSlackTeam() {
    return `/api/v0/clients/${firebaseConfig.projectId}/slack-team`;
  },
};
