const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const templatesModel = require('../../../models/templates');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../properties/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');

describe('Properties | API | POST', () => {
  afterEach(() => cleanDb(null, fs));

  it('should create a new property', async () => {
    const templateId = uuid();
    const expected = {
      name: 'POST Property',
      templates: {
        [templateId]: true,
      },
    };
    const template = mocking.createTemplate();

    // Setup Database
    await templatesModel.createRecord(fs, templateId, template);

    // Execute
    const app = createApp();
    const res = await request(app)
      .post(`/t`)
      .send(expected)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const propDoc = body ? body.data : {};
    const propertyId = propDoc.id || 'na';
    const propertyDoc = await propertiesModel.findRecord(fs, propertyId);
    const actual = propertyDoc.data() || {};

    // Assertions
    expect(actual).to.deep.equal(expected);
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
