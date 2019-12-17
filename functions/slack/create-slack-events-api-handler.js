const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const log = require('../utils/logger');
const slackService = require('../services/slack');

const PREFIX = 'slack: slack events API handler:';

/**
 * Factory for deleting Trello authorizor
 * for the organization and property configs
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteSlackAppHandler(db) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { body } = req;

    log.info(`${PREFIX} event type: ${body.type}`);

    if (body.type === 'url_verification') {
      res.status(200).send({ challenge: body.challenge });
      return;
    }

    if (body.event.type === 'app_uninstalled' && body.team_id) {
      try {
        await slackService.handleAppUninstalledEvent(db, body.team_id);
      } catch (err) {
        log.error(
          `${PREFIX} Error retrieved from app_uninstalled event: ${err}`
        );
        return res.status(200).send({
          message: 'error',
        });
      }
    }

    res.status(200).send({ message: 'successful' });
  };

  // Create express app with single DELETE endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post('/', handler);

  return app;
};
