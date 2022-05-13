const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const integrationsModel = require('../../../models/integrations');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../trello/api/delete-property-integration');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Integrations | API | DELETE Property Inegration', () => {
  afterEach(() => cleanDb(db));

  it('should remove an existing property trello integration', async () => {
    const propertyId = uuid();
    const property = mocking.createProperty();
    const integration = mocking.createPropertyTrelloIntegration();
    const expected = false;

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);
    await integrationsModel.createTrelloProperty(db, propertyId, integration);

    // Execute
    const app = createApp();
    await request(app)
      .delete(`/t/${propertyId}?incognitoMode=true`)
      .send()
      .expect(204);

    // Get Results
    const snapshot = await integrationsModel.findTrelloProperty(db, propertyId);
    const actual = snapshot.exists;

    // Assertion
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete('/t/:propertyId', stubAuth, handler(db));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
