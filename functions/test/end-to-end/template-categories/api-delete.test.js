const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const handler = require('../../../template-categories/api/delete');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const mocking = require('../../../test-helpers/mocking');
const { db } = require('../../setup');
const templatesModel = require('../../../models/templates');
const templatesCategoryModel = require('../../../models/template-categories');

describe('Template Categories | API | DELETE', () => {
  afterEach(() => cleanDb(db));

  it("should disassociate all deleted template category's associated templates", async () => {
    const tmplCat1Id = uuid();
    const tmplCat2Id = uuid();
    const template1Id = uuid();
    const template2Id = uuid();
    const template3Id = uuid();
    const template1Data = mocking.createTemplate({
      category: tmplCat1Id,
    });
    const template2Data = mocking.createTemplate({
      category: tmplCat1Id,
    });
    const template3Data = mocking.createTemplate({
      category: tmplCat2Id,
    });
    const tmplCat1Data = mocking.createTemplateCategory({
      name: 'One',
    });
    const tmplCat2Data = mocking.createTemplateCategory({
      name: 'Two',
    });

    // Setup database
    await templatesModel.createRecord(db, template1Id, template1Data);
    await templatesModel.createRecord(db, template2Id, template2Data);
    await templatesModel.createRecord(db, template3Id, template3Data);
    await templatesCategoryModel.createRecord(db, tmplCat1Id, tmplCat1Data);
    await templatesCategoryModel.createRecord(db, tmplCat2Id, tmplCat2Data);

    // Execute
    const app = createApp();
    await request(app)
      .delete(`/t/${tmplCat1Id}`)
      .send()
      .expect(204);

    // Test result
    const tmplCat1Snap = await templatesCategoryModel.findRecord(
      db,
      tmplCat1Id
    );
    const tmplCat2Snap = await templatesCategoryModel.findRecord(
      db,
      tmplCat2Id
    );
    const templat1Snap = await templatesModel.findRecord(db, template1Id);
    const template2Snap = await templatesModel.findRecord(db, template2Id);
    const template3Snap = await templatesModel.findRecord(db, template3Id);
    delete template1Data.category;
    delete template2Data.category;

    // Assertions
    [
      {
        actual: tmplCat1Snap.data() || {},
        expected: {},
        msg: 'template category 1 was removed',
      },
      {
        actual: tmplCat2Snap.data() || null,
        expected: tmplCat2Data,
        msg: 'template category 2 is unchanged',
      },
      {
        actual: templat1Snap.data() || null,
        expected: template2Data,
        msg: 'removed template 1 category association',
      },
      {
        actual: template2Snap.data() || null,
        expected: template2Data,
        msg: 'removed template 2 category association',
      },
      {
        actual: template3Snap.data() || null,
        expected: template3Data,
        msg: 'template 3 is unchanged',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.delete('/t/:templateCategoryId', handler(db));
  return app;
}
