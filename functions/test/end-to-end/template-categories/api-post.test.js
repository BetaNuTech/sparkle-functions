const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const templateCategoriesModel = require('../../../models/template-categories');
const handler = require('../../../template-categories/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Template Categories | API | POST', () => {
  afterEach(() => cleanDb(db));

  it('should create a new template category', async () => {
    const expected = 'New Template Category';

    // Execute
    const app = createApp();
    const res = await request(app)
      .post('/t')
      .send({ name: expected })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const tmplCatDoc = body ? body.data : {};
    const tmplCatId = tmplCatDoc.id || 'na';
    const tmplCatSnap = await templateCategoriesModel.findRecord(db, tmplCatId);
    const result = tmplCatSnap.data() || {};
    const actual = result.name;

    // Assertion
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), handler(db));
  return app;
}
