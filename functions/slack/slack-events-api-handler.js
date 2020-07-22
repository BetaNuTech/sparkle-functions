const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const log = require('../utils/logger');
const slackService = require('../services/slack');
const integrationsModel = require('../models/integrations');

const PREFIX = 'slack: slack events API handler:';

/**
 * Factory for deleting Trello authorizor
 * for the organization and property configs
 * DEPRECATED: remove when Firebase DB dropped
 * @param  {admin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteSlackAppHandler(db) {
  assert(db && typeof db.ref === 'function', 'has realtime db');

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { body } = req;
    const teamId = (body || {}).team_id || '';

    log.info(`${PREFIX} event type: ${body.type}`);

    if (body.type === 'url_verification') {
      res.status(200).send({ challenge: body.challenge });
      return;
    }

    if (body.event.type === 'app_uninstalled' && teamId) {
      let wasAuthorized = false;
      try {
        wasAuthorized = await integrationsModel.isAuthorizedSlackTeam(
          db,
          null,
          teamId
        );
      } catch (err) {
        log.error(`${PREFIX} app_uninstalled team lookup failed: ${err}`);
        return res.status(200).send({ message: 'error' });
      }

      if (wasAuthorized) {
        try {
          await slackService.clearDatabaseFromSlackReferences(db);
        } catch (err) {
          log.error(`${PREFIX} app_uninstalled slack clean failed: ${err}`);
          return res.status(200).send({ message: 'error' });
        }
      }
    }

    log.info(`${PREFIX} Slack app uninstalled by via Slack API`);
    res.status(200).send({ message: 'successful' });
  };

  // Create express app with single DELETE endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post('/', handler);

  return app;
};
