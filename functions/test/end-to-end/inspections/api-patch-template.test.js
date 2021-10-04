const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/patch-template');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Inspections | API | PATCH Template', () => {
  afterEach(() => cleanDb(null, db));

  it('should update a inspection record', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      inspectionReportURL: 'old-url.com',
      inspectionReportUpdateLastDate: 1601494027,
      inspectionCompleted: true,
      templateName: 'template',
      template: mocking.createTemplate({
        name: 'template',
        items: { [itemId]: mocking.createItem({ sectionId }) },
        sections: { [sectionId]: mocking.createSection() },
      }),
    });
    const update = {
      items: {
        [itemId]: {
          textInputValue: 'New valid value',
        },
      },
    };
    const expected = JSON.parse(JSON.stringify(inspection));
    expected.template.items[itemId].textInputValue =
      update.items[itemId].textInputValue;

    // Setup database
    await inspectionsModel.createRecord(db, inspectionId, inspection);

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}/template`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const updatedInspection = await inspectionsModel.findRecord(
      db,
      inspectionId
    );

    // Assertions
    const actual = updatedInspection.data() || null;
    delete actual.updatedAt;
    expect(actual).to.deep.equal(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.patch(
    '/t/:inspectionId/template',
    bodyParser.json(),
    stubAuth(user),
    handler(db)
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: uuid() }, user);
    next();
  };
}
