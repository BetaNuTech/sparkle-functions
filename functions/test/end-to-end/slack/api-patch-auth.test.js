const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../slack/api/patch-auth');
const { cleanDb } = require('../../../test-helpers/firebase');
const integrationsModel = require('../../../models/integrations');
const mocking = require('../../../test-helpers/mocking');
const { db } = require('../../setup');

describe('Slack | API | PATCH Auth', () => {
  afterEach(() => cleanDb(db));

  it('successfully updates the Slack integration system channel', async () => {
    const integration = mocking.createSlackIntegration({
      joinedChannelNames: { testing: 1234 },
    });
    const expected = {
      ...integration,
      defaultChannelName: 'new-channel-name-9000',
    };

    // Setup Database
    await integrationsModel.setSlack(db, integration);

    // Execute
    const app = createApp();
    await request(app)
      .patch('/t')
      .send({ defaultChannelName: expected.defaultChannelName })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const snapshot = await integrationsModel.findSlack(db);
    const actual = snapshot.data() || {};

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('successfully removes the Slack integration system channel', async () => {
    const integration = mocking.createSlackIntegration({
      defaultChannelName: 'exists',
      joinedChannelNames: { testing: 1234 },
    });
    const expected = {
      ...integration,
      defaultChannelName: '',
    };

    // Setup Database
    await integrationsModel.setSlack(db, integration);

    // Execute
    const app = createApp();
    await request(app)
      .patch('/t')
      .send({ defaultChannelName: '' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const snapshot = await integrationsModel.findSlack(db);
    const actual = snapshot.data() || {};

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/t', bodyParser.json(), stubAuth, handler(db));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
