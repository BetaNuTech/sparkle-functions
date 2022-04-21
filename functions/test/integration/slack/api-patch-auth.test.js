const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../slack/api/patch-auth');
const firebase = require('../../../test-helpers/firebase');
const mocking = require('../../../test-helpers/mocking');

describe('Slack | API | PATCH Slack Authorization', () => {
  afterEach(() => sinon.restore());

  it('rejects a request to update Slack details with invalid payload', async () => {
    const expected = 'body';

    const res = await request(createApp())
      .patch('/t')
      .send({ defaultChannelName: 1 })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    const result = res.body.errors[0] || {};
    const actual = (result.source || {}).pointer || '';
    expect(actual).to.contain(expected);
  });

  it('rejects request to update Slack details that cannot be found', () => {
    // Stubs
    sinon
      .stub(integrationsModel, 'findSlack')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .patch('/t')
      .send({ defaultChannelName: 'updated' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404); // Assertion
  });

  it('updates converts user updates into a valid slack channel name', async () => {
    const expected = 'channel-name';
    const integration = mocking.createSlackIntegration({});

    // Stubs
    sinon
      .stub(integrationsModel, 'findSlack')
      .resolves(firebase.createDocSnapshot('slack', integration)); // empty
    sinon.stub(integrationsModel, 'updateSlack').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    const res = await request(createApp())
      .patch('/t')
      .send({ defaultChannelName: 'channel name' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201); // Assertion

    const actual = res.body.data.attributes.defaultChannelName;
    expect(actual).to.equal(expected);
  });

  it('sends notification upon successful Slack details update', async () => {
    const expected = 'Slack App Update';
    const integration = mocking.createSlackIntegration({});

    // Stubs
    sinon
      .stub(integrationsModel, 'findSlack')
      .resolves(firebase.createDocSnapshot('slack', integration)); // empty
    sinon.stub(integrationsModel, 'updateSlack').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch('/t')
      .send({ defaultChannelName: 'updated' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201); // Assertion

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || {}).title || '';
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t',
    bodyParser.json(),
    stubAuth,
    handler({
      collection: () => {},
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
