const request = require('supertest');
const { expect } = require('chai');
const bodyParser = require('body-parser');
const express = require('express');
const sinon = require('sinon');
const integrationsModel = require('../../../models/integrations');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../trello/api/put-property-integration');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Trello | API | PUT Property Integration', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request with missing update payload', async () => {
    const propertyId = uuid();
    const expected = 'Bad Request: update body required';

    // Execute
    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request with empty update payload', async () => {
    const propertyId = uuid();
    const expected = 'Bad Request: update body required';

    // Execute
    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update trello integration with invalid payload attribute', async () => {
    const expected = 'unknown';
    const propertyId = uuid();
    const invalidUpdate = { unknown: 'test' };

    // Execute
    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const { source = {} } = error;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update trello integration with invalid payload value', async () => {
    const expected = 'openBoard';
    const propertyId = uuid();
    const invalidUpdate = { openBoard: 1 };

    // Execute
    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const { source = {} } = error;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update integration of non-existent property', async () => {
    const propertyId = uuid();
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send({ openBoard: uuid(), openBoardName: 'Test' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('sends a successfully response when update was successful', () => {
    const propertyId = uuid();
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(integrationsModel, 'setTrelloPropertyRecord').resolves();

    return request(createApp())
      .put(`/t/${propertyId}?incognitoMode=true`)
      .send({ openBoard: uuid(), openBoardName: 'Test' })
      .expect(201); // Assertion
  });

  it('sends change notification upon successful update', async () => {
    const propertyId = uuid();
    const property = mocking.createProperty();
    const expected = 'Trello Settings Change for Property';

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(integrationsModel, 'setTrelloPropertyRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .put(`/t/${propertyId}`)
      .send({ openBoard: uuid(), openBoardName: 'Test' })
      .expect(201); // Assertion

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { title: '' }).title;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const propertyId = uuid();
    const property = mocking.createProperty();
    const expected = false;

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(integrationsModel, 'setTrelloPropertyRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .put(`/t/${propertyId}?incognitoMode=true`)
      .send({ openBoard: uuid(), openBoardName: 'Test' })
      .expect(201); // Assertion

    const actual = addNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put(
    '/t/:propertyId',
    bodyParser.json(),
    stubAuth,
    stubTrelloReq,
    handler(firebase.createFirestoreStub())
  );
  return app;
}

function stubTrelloReq(req, res, next) {
  req.trelloCredentials = {
    authToken: 'token',
    apikey: 'key',
  };
  next();
}

function stubAuth(req, res, next) {
  req.user = { admin: true, id: '123' };
  next();
}
