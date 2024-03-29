const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const templatesModel = require('../../../models/templates');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../properties/api/put');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Properties | API | PUT', () => {
  afterEach(() => cleanDb(db));

  it('should update an existing property', async () => {
    const propertyId = uuid();
    const templateId = uuid();
    const update = {
      name: 'Updated Property',
      templates: {
        [templateId]: true,
      },
    };
    const property = mocking.createProperty();
    const expected = { ...property, ...update };
    const template = mocking.createTemplate();

    // Setup Database
    await propertiesModel.createRecord(db, propertyId, property);
    await templatesModel.createRecord(db, templateId, template);

    // Execute
    const app = createApp();
    await request(app)
      .put(`/t/${propertyId}`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const propertyDoc = await propertiesModel.findRecord(db, propertyId);
    const actual = propertyDoc.data() || {};

    // Assertions
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
