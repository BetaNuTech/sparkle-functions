const assert = require('assert');
const log = require('../../utils/logger');
const slack = require('../../services/slack');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'slack: api: delete-auth:';

/**
 * Factory for deleting Slack authorizor
 * for the organization and property configs
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteSlackAppHandler(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user } = req;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

    // get slack access token
    let accessToken = '';
    try {
      const slackCredentialsSnap = await systemModel.findSlack(fs);
      const slackCredentials = slackCredentialsSnap.data() || {};
      accessToken = slackCredentials.accessToken || '';

      if (!accessToken) {
        throw Error('slack authentication credentials not found');
      }
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      return res.status(400).send({
        errors: [{ detail: 'No Slack App authorized for your organization' }],
      });
    }

    // Send request to apps.uninstall slack api endpoint
    try {
      await slack.uninstallApp(accessToken);
    } catch (err) {
      return send500Error(
        err,
        `error retrieved from Slack API: ${err}`,
        `Error from slack API: ${err}`
      );
    }

    const batch = fs.batch();

    // Delete system's Slack App credentials
    try {
      await systemModel.removeSlack(fs, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to remove slack system credentials | ${err}`,
        'system failure'
      );
    }

    // Delete public facing Slack App's integration details
    try {
      await integrationsModel.removeSlack(fs, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to remove public integration details | ${err}`,
        'system failure'
      );
    }

    // Cleanup all lingering Slack notifications
    try {
      await notificationsModel.removeAllSlack(fs, batch);
    } catch (err) {
      log.error(`${PREFIX} failed to remove slack notifications | ${err}`);
    }

    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `failed to commit writes to database | ${err}`,
        'system failure'
      );
    }

    log.info(`${PREFIX} Slack app uninstalled by user: "${user.id}"`);
    res.status(204).send();
  };
};
