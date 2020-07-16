const nock = require('nock');
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../slack/api/delete-auth');
const { cleanDb } = require('../../../test-helpers/firebase');
const { slackApp } = require('../../../config');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const { fs } = require('../../setup');

const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;

describe('Slack | API | DELETE Auth', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(null, fs);
  });

  it('uses stored access token to request to uninstall Slack App', async () => {
    const expected = true;
    const result = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
    };

    // Stub API
    const uninstallRequest = nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${result.accessToken}`
      )
      .reply(200, {
        ok: true,
        error: '',
      });

    // setup database
    await systemModel.firestoreUpsertSlack(fs, {
      token: result.accessToken,
      scope: result.scope,
    });

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const actual = uninstallRequest.isDone();

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove systems slack app credentials after successful uninstall', async () => {
    const expected = false;
    const credentials = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
    };

    // Stub API
    nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${credentials.accessToken}`
      )
      .reply(200, {
        ok: true,
        error: '',
      });

    // setup database
    await systemModel.firestoreUpsertSlack(fs, {
      token: credentials.accessToken,
      scope: credentials.scope,
    });

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const result = await systemModel.firestoreFindSlack(fs);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove public facing slack app details after successful uninstall', async () => {
    const expected = false;
    const credentials = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
    };

    // Stub API
    nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${credentials.accessToken}`
      )
      .reply(200, {
        ok: true,
        error: '',
      });

    // setup database
    await systemModel.firestoreUpsertSlack(fs, {
      token: credentials.accessToken,
      scope: credentials.scope,
    });
    await integrationsModel.firestoreSetSlack(fs, {
      grantedBy: '123',
      team: '456',
      teamName: 'testers',
    });

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const result = await integrationsModel.firestoreFindSlack(fs);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove all slack notifications after successful uninstall', async () => {
    const expected = 0;
    const credentials = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
    };

    // Stub API
    nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${credentials.accessToken}`
      )
      .reply(200, {
        ok: true,
        error: '',
      });

    // setup database
    await systemModel.firestoreUpsertSlack(fs, {
      token: credentials.accessToken,
      scope: credentials.scope,
    });
    await notificationsModel.firestoreAddRecord(fs, {
      medium: 'slack',
      channel: 'test',
      title: 'test',
      message: 'message',
      src: '123',
    });

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const result = await notificationsModel.firestoreFindAllSlack(fs);
    const actual = result.size;

    // Assertions
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete('/t', bodyParser.json(), stubAuth, handler(fs));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
