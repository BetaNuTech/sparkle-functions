const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');
const { slackApp } = require('../config');
const slackService = require('../services/slack');

const PREFIX = 'slack: slack app delete:';
const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;

/**
 * Factory for deleting Trello authorizor
 * for the organization and property configs
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteSlackAppHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user } = req;

    // Reject unauthenticated user
    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // get slack access token
    let accessToken = '';
    try {
      const slackIntegrationCredentialsSnap = await systemModel.findSlackCredentials(
        db
      );

      const slackCredentials = slackIntegrationCredentialsSnap.val() || {};
      accessToken = slackCredentials.accessToken || '';

      if (!accessToken) {
        throw Error('slack authentication credentials not found');
      }
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      return res
        .status(400)
        .send({ message: 'No Slack App is authorized for your organization' });
    }

    // Send request to apps.uninstall slack api endpoint
    try {
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
    } catch (err) {
      log.error(`${PREFIX} Error retrieved from Slack API: ${err}`);
      return res.status(err.statusCode || 500).send({
        message: `Error from slack API: ${err}`,
      });
    }

    try {
      await slackService.clearDatabaseFromSlackReferences(db);
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      return res.status(500).send({ message: 'system failure' });
    }

    res.status(200).send({ message: 'successful' });
  };

  // Create express app with single DELETE endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.delete(
    '/integrations/slack/authorization',
    authUser(db, auth, true),
    handler
  );

  return app;
};
