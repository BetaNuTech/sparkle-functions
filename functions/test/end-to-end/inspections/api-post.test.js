const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const templatesModel = require('../../../models/templates');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Inspections | API | POST', () => {
  afterEach(() => cleanDb(null, db));

  it('should create a new inspection', async () => {
    const expected = true;
    const propertyId = uuid();
    const templateId = uuid();
    const property = mocking.createProperty({ templates: templateId });
    const template = mocking.createTemplate({
      properties: [templateId],
      items: {},
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(db, propertyId, property);
    await templatesModel.firestoreCreateRecord(db, templateId, template);

    // Execute
    const app = createApp();
    const res = await request(app)
      .post(`/t/${propertyId}`)
      .send({ template: templateId })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const inspDoc = body ? body.data : {};
    const jobId = inspDoc.id || 'na';
    const job = await inspectionsModel.firestoreFindRecord(db, jobId);
    const actual = Boolean(job.data() || null);

    expect(actual).to.equal(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.post('/t/:propertyId', bodyParser.json(), stubAuth(user), handler(db));
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: uuid() }, user);
    next();
  };
}
