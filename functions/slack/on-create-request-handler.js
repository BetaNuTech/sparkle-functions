const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const { firebase: firebaseConfig, slackApp } = require('../config');

const PREFIX = 'slack: app authorization on create:';
const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;
const SERVICE_ACCOUNT_CLIENT_ID =
  firebaseConfig.databaseAuthVariableOverride.uid;
/**
 * Factory for slack app authorization endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnSlackAppAuthHandler(db, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Write slack app auth to integration/slack
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createSlackAuthHandler = async (req, res) => {
    const { user, body } = req;
    const { slackCode, redirectUri } = body;

    // Reject unauthenticated user
    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // Reject impropertly stuctured request body
    if (!slackCode || !redirectUri) {
      let message = '';

      if (!body) {
        message = 'invalid request';
        log.error(`${PREFIX} request badly formed`);
      } else {
        message += 'Slack Auth Handler requires:';

        if (!slackCode) {
          message += ' slackCode';
          log.error(`${PREFIX} request body missing slackCode`);
        }

        if (!redirectUri) {
          message += ' redirectUri';
          log.error(`${PREFIX} request body missing redirectUri`);
        }
      }

      return res.status(400).send({ message });
    }

    let slackResponse = null;
    try {
      const queryParams = `?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${slackCode}&redirect_uri=${redirectUri}`;
      const response = await got(
        `https://slack.com/api/oauth.access${queryParams}`,
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
        throw Error(respErrMsg || 'Unknown Slack API error');
      }

      slackResponse = response.body;
    } catch (error) {
      log.error(`${PREFIX} Error retrieved from Slack API: ${error}`);
      return res.status(error.statusCode || 500).send({
        message: `Error from slack API: ${error}`,
      });
    }

    log.info(
      `${PREFIX} slack app authentication success for team name: ${slackResponse.team_name} - team id: ${slackResponse.team_id}`
    );

    try {
      await db
        .ref(
          `/system/integrations/slack/organization/${SERVICE_ACCOUNT_CLIENT_ID}`
        )
        .set({
          accessToken: slackResponse.access_token,
          scope: slackResponse.scope,
          createdAt: Date.now(),
        });
    } catch (error) {
      log.error(
        `${PREFIX} Error attempting to save slack integration: ${error}`
      );
      return res.status(error.statusCode || 500).send({
        message: 'Error from slack API',
      });
    }

    res
      .status(201)
      .send({ message: 'successfully saved slack app authroization' });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post(
    '/integrations/slack/authorization',
    authUser(db, auth, true),
    createSlackAuthHandler
  );
  return app;
};
