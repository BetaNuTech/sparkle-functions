const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'slack: api: events-webhook:';

/**
 * Creates webhook for responding to Slack API requests
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteSlackAppHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body } = req;
    const teamId = (body || {}).team_id || '';
    const requestType = (body || {}).type || '';
    const eventType = ((body || {}).event || {}).type || '';
    const send500Error = create500ErrHandler(PREFIX, res);

    if (requestType === 'url_verification') {
      log.info(`${PREFIX} Slack url verification challenge`);
      return res.status(200).send({ challenge: body.challenge });
    }

    if (eventType === 'app_uninstalled' && teamId) {
      let wasAuthorized = false;
      try {
        wasAuthorized = await integrationsModel.isAuthorizedSlackTeam(
          db,
          teamId
        );
      } catch (err) {
        log.error(`${PREFIX} app_uninstalled team lookup failed: ${err}`);
        return res.status(200).send({ message: 'error' });
      }

      if (wasAuthorized) {
        log.info(`${PREFIX} Slack app uninstalled from workspace`);

        // Start Firestore DB cleanup
        const batch = db.batch();

        // Delete system's Slack App credentials
        try {
          await systemModel.removeSlack(db, batch);
        } catch (err) {
          return send500Error(
            err,
            `failed to remove slack system credentials: ${err}`,
            'system failure'
          );
        }

        // Delete public facing Slack App's integration details
        try {
          await integrationsModel.removeSlack(db, batch);
        } catch (err) {
          return send500Error(
            err,
            `failed to remove public integration details: ${err}`,
            'system failure'
          );
        }

        // Cleanup all lingering Slack notifications
        try {
          await notificationsModel.removeAllSlack(db, batch);
        } catch (err) {
          log.error(`${PREFIX} failed to remove slack notifications: ${err}`);
        }

        try {
          await batch.commit();
        } catch (err) {
          return send500Error(
            err,
            `failed to commit writes to database: ${err}`,
            'system failure'
          );
        }
      }
    }

    res.status(200).send({ message: 'successful' });
  };
};
