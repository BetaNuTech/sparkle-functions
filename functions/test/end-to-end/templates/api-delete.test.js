const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const handler = require('../../../templates/api/delete');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const mocking = require('../../../test-helpers/mocking');
const { db } = require('../../setup');
const propertiesModel = require('../../../models/properties');
const templatesModel = require('../../../models/templates');

describe('Templates | API | DELETE', () => {
  afterEach(() => cleanDb(db));

  it("should remove template with all it's property associations", async () => {
    const template1Id = uuid();
    const template2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property1Data = mocking.createProperty({
      templates: { [template1Id]: true },
    });
    const property2Data = mocking.createProperty({
      templates: { [template1Id]: true, [template2Id]: true },
    });
    const template1Data = mocking.createTemplate();

    // Setup database
    await propertiesModel.createRecord(db, property1Id, property1Data);
    await propertiesModel.createRecord(db, property2Id, property2Data);
    await templatesModel.createRecord(db, template1Id, template1Data);

    // Execute
    const app = createApp();
    await request(app)
      .delete(`/t/${template1Id}?incognitoMode=true`)
      .send()
      .expect(204);

    // Test result
    const templateSnap = await templatesModel.findRecord(db, template1Id);
    const prop1Snap = await propertiesModel.findRecord(db, property1Id);
    const prop2Snap = await propertiesModel.findRecord(db, property2Id);
    delete property1Data.templates[template1Id];
    delete property2Data.templates[template1Id];

    // Assertions
    [
      {
        actual: templateSnap.data() || {},
        expected: {},
        msg: 'template was removed',
      },
      {
        actual: prop1Snap.data() || null,
        expected: property1Data,
        msg: 'removed property 1 template association',
      },
      {
        actual: prop2Snap.data() || null,
        expected: property2Data,
        msg: 'removed property 2 template association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.delete('/t/:templateId', handler(db));
  return app;
}
