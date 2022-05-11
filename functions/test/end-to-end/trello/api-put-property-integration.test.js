const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const integrationsModel = require('../../../models/integrations');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../trello/api/put-property-integration');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Integrations | API | PUT Property Inegration', () => {
  afterEach(() => cleanDb(null, db));

  it('should update an existing property trello integration', async () => {
    const update = {
      openBoard: uuid(),
      openBoardName: 'Updated Trello Board Ab3348',
    };
    const propertyId = uuid();
    const property = mocking.createProperty();
    const integration = mocking.createPropertyTrelloIntegration();
    const expected = { ...integration, ...update };
    delete expected.updatedAt;
    delete expected.createdAt;

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);
    await integrationsModel.createTrelloProperty(db, propertyId, integration);

    // Execute
    const app = createApp();
    await request(app)
      .put(`/t/${propertyId}?incognitoMode=true`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const snapshot = await integrationsModel.findTrelloProperty(db, propertyId);
    const actual = snapshot.data() || {};
    delete actual.updatedAt;
    delete actual.createdAt;

    // Assertion
    expect(actual).to.deep.equal(expected);
  });

  it('should create a new property trello integration', async () => {
    const propertyId = uuid();
    const property = mocking.createProperty();
    const update = mocking.createPropertyTrelloIntegration();
    delete update.updatedAt;
    delete update.createdAt;
    const expected = { ...update };

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);

    // Execute
    const app = createApp();
    await request(app)
      .put(`/t/${propertyId}?incognitoMode=true`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const snapshot = await integrationsModel.findTrelloProperty(db, propertyId);
    const actual = snapshot.data() || {};
    delete actual.updatedAt;
    delete actual.createdAt;

    // Assertion
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put('/t/:propertyId', bodyParser.json(), stubAuth, handler(db));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
