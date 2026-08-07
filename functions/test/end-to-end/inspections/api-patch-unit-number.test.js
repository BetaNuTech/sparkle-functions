const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../inspections/api/patch-unit-number');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');

const PROPERTY_ID = uuid();
const INSPECTION_ID = uuid();
const COMPLETION_DATE = 1601494027;
const UPDATED_AT = 1601494127;
const UPDATED_LAST_DATE = 1601494227;
const INSPECTION_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  inspectionCompleted: true,
  completionDate: COMPLETION_DATE,
  updatedAt: UPDATED_AT,
  updatedLastDate: UPDATED_LAST_DATE,
});

describe('Inspections | API | Patch Unit Number', () => {
  afterEach(() => cleanDb(db));

  it("updates a completed inspection's unit number without effecting its dates", async () => {
    const expected = 'A12';

    // Setup database
    await inspectionsModel.createRecord(db, INSPECTION_ID, INSPECTION_DATA);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ unitNumber: expected })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(201);

    // Get Results
    const inspectionSnap = await inspectionsModel.findRecord(db, INSPECTION_ID);
    const actual = inspectionSnap.data() || {};

    // Assertions
    [
      {
        actual: actual.unitNumber,
        expected,
        msg: "updated firestore inspection's unit number",
      },
      {
        actual: actual.completionDate,
        expected: COMPLETION_DATE,
        msg: "did not modify firestore inspection's completion date",
      },
      {
        actual: actual.updatedAt,
        expected: UPDATED_AT,
        msg: "did not modify firestore inspection's updated at",
      },
      {
        actual: actual.updatedLastDate,
        expected: UPDATED_LAST_DATE,
        msg: "did not modify firestore inspection's updated last date",
      },
      {
        actual: actual.inspectionReportStatus,
        expected: INSPECTION_DATA.inspectionReportStatus,
        msg: 'did not queue a new inspection PDF report',
      },
    ].forEach(({ actual: act, expected: exp, msg }) => {
      expect(act).to.equal(exp, msg);
    });
  });

  it("removes an inspection's unit number when provided an empty value", async () => {
    const expected = '';

    // Setup database
    await inspectionsModel.createRecord(db, INSPECTION_ID, {
      ...INSPECTION_DATA,
      unitNumber: 'A12',
    });

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send({ unitNumber: '' })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(201);

    // Get Results
    const inspectionSnap = await inspectionsModel.findRecord(db, INSPECTION_ID);
    const actual = (inspectionSnap.data() || {}).unitNumber;

    // Assertions
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:inspectionId', bodyParser.json(), handler(db));
  return app;
}
