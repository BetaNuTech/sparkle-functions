const nock = require('nock');
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../slack/api/post-auth');
const { cleanDb } = require('../../../test-helpers/firebase');
const { slackApp, globalApi } = require('../../../config');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const { fs } = require('../../setup');

const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;
const GLOBAL_API_DOMAIN = globalApi.domain;
const GLOBAL_API_PATCH_PATH = globalApi.patchSlackTeam;

describe('Slack | API | POST Auth', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(null, fs);
  });

  it('successfully creates new Slack integration documents', async () => {
    const result = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
      teamName: 'Slack Team Name',
      team: '2131',
      defaultChannelName: 'test_channel',
    };
    const slackCode = 'code';
    const redirectUri = '/test';

    // Stub API
    nock('https://slack.com')
      .persist()
      .post(
        `/api/oauth.v2.access?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${slackCode}&redirect_uri=${redirectUri}`
      )
      .reply(200, {
        ok: true,
        access_token: result.accessToken,
        scope: result.scope,
        user_id: 'U0FAKEID',
        team: {
          id: result.team,
          name: result.teamName,
        },
        incoming_webhook: {
          channel: `#${result.defaultChannelName}`,
          channel_id: 'C0HANNELID',
          configuration_url: 'https://orgname.slack.com/services/SERVICEID',
          url: 'https://hooks.slack.com/services/SERVICEID/FAKEID123/NOTHING',
        },
      });
    nock(GLOBAL_API_DOMAIN)
      .persist()
      .patch(GLOBAL_API_PATCH_PATH)
      .reply(204, {});

    // Execute
    const app = createApp();
    await request(app)
      .post('/t?incognitoMode=true')
      .send({ slackCode, redirectUri })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const systemDoc = await systemModel.findSlack(fs);
    const integrationDoc = await integrationsModel.findSlack(fs);

    // Assertions
    [
      {
        actual: (systemDoc.data() || {}).accessToken || '',
        expected: result.accessToken,
        msg: 'stored access token in system credentials',
      },
      {
        actual: (systemDoc.data() || {}).scope || '',
        expected: result.scope,
        msg: 'stored slack scope in system credentials',
      },
      {
        actual: (integrationDoc.data() || {}).team,
        expected: result.team,
        msg: 'stored slack team id in integration details',
      },
      {
        actual: (integrationDoc.data() || {}).teamName,
        expected: result.teamName,
        msg: 'stored slack team name in integration details',
      },
      {
        actual: (integrationDoc.data() || {}).defaultChannelName,
        expected: result.defaultChannelName,
        msg: 'stored users channel selection in integration details',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), stubAuth, handler(fs));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
