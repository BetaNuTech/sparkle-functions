const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const templatesModel = require('../../../models/templates');
const handler = require('../../../templates/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Templates | API | POST', () => {
  afterEach(() => cleanDb(null, db));

  it('should create a new template', async () => {
    const expected = 'New Template -';

    // Execute
    const app = createApp();
    const res = await request(app)
      .post('/t')
      .send()
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const templateDoc = body ? body.data : {};
    const templateId = templateDoc.id || 'na';
    const templateSnap = await templatesModel.findRecord(db, templateId);
    const result = templateSnap.data() || {};
    const actual = result.name;

    // Assertion
    expect(actual).to.contain(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), handler(db));
  return app;
}
