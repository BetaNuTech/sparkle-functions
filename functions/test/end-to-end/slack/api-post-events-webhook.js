const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../slack/api/post-events-webhook');
const { cleanDb } = require('../../../test-helpers/firebase');
const uuid = require('../../../test-helpers/uuid');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const { db } = require('../../setup');

describe('Slack | API | POST events webhook', () => {
  afterEach(() => {
    return cleanDb(db);
  });

  it('should remove systems slack app credentials after successful uninstall', async () => {
    const expected = false;
    const teamId = uuid();

    // setup database
    await systemModel.upsertSlack(db, {
      token: 'abc-123',
      scope: 'scope',
    });
    await integrationsModel.setSlack(db, {
      grantedBy: '123',
      team: teamId,
      teamName: 'testers',
    });

    // Execute
    const app = createApp();
    await request(app)
      .post('/t')
      .send({ team_id: teamId, event: { type: 'app_uninstalled' } })
      .expect(200);

    // Get Results
    const result = await systemModel.findSlack(db);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove public facing slack app details after successful uninstall', async () => {
    const expected = false;
    const teamId = uuid();

    // setup database
    await systemModel.upsertSlack(db, {
      token: 'abc-123',
      scope: 'scope',
    });
    await integrationsModel.setSlack(db, {
      grantedBy: '123',
      team: teamId,
      teamName: 'testers',
    });

    // Execute
    const app = createApp();
    await request(app)
      .post('/t')
      .send({ team_id: teamId, event: { type: 'app_uninstalled' } })
      .expect(200);

    // Get Results
    const result = await integrationsModel.findSlack(db);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove all slack notifications after successful uninstall', async () => {
    const expected = 0;
    const teamId = uuid();

    // setup database
    await systemModel.upsertSlack(db, {
      token: 'abc-123',
      scope: 'scope',
    });
    await integrationsModel.setSlack(db, {
      grantedBy: '123',
      team: teamId,
      teamName: 'testers',
    });
    await notificationsModel.addRecord(db, {
      medium: 'slack',
      channel: 'test',
      title: 'test',
      message: 'message',
      src: '123',
    });

    // Execute
    const app = createApp();
    await request(app)
      .post('/t')
      .send({ team_id: teamId, event: { type: 'app_uninstalled' } })
      .expect(200);

    // Get Results
    const result = await notificationsModel.findAllSlack(db);
    const actual = result.size;

    // Assertions
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), handler(db));
  return app;
}
