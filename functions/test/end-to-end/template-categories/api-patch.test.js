const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const templateCategoriesModel = require('../../../models/template-categories');
const templatesCategoryModel = require('../../../models/template-categories');
const handler = require('../../../template-categories/api/patch');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Template Categories | API | PATCH', () => {
  afterEach(() => cleanDb(null, db));

  it('should update an existing template category', async () => {
    const expected = 'New Name';
    const tmplCatId = uuid();
    const tmplCatData = mocking.createTemplateCategory({
      name: 'Old name',
    });

    // Setup database
    await templatesCategoryModel.createRecord(db, tmplCatId, tmplCatData);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${tmplCatId}`)
      .send({ name: expected })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const tmplCatSnap = await templateCategoriesModel.findRecord(db, tmplCatId);
    const result = tmplCatSnap.data() || {};
    const actual = result.name;

    // Assertion
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:templateCategoryId', bodyParser.json(), handler(db));
  return app;
}
