const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../inspections/api/patch-report-pdf');
const { cleanDb } = require('../../../test-helpers/firebase');
const stubs = require('../../../test-helpers/stubs');
const { fs: db, storage } = require('../../setup');

// Avoid creating lots of PDF's
const INSP_ID = uuid();
const PROPERTY_ID = uuid();
const SECTION_ID = uuid();
const INSPECTION_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  score: 100,
  totalItems: 1,
  inspectionReportURL: 'old-url.com',
  inspectionReportUpdateLastDate: 1601494027,
  inspectionReportStatusChanged: 1,
  inspectionCompleted: true,
  template: {
    name: 'template',
    items: { [uuid()]: mocking.createItem({ sectionId: SECTION_ID }) },
    sections: { [SECTION_ID]: mocking.createSection() },
  },
});
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
  inspections: { [INSP_ID]: true },
};

describe('Inspections | API | PATCH PDF Report', () => {
  afterEach(() => cleanDb(null, db));

  it('should queue an inspection for PDF report generation on success', async function() {
    // Setup database
    await inspectionsModel.createRecord(db, INSP_ID, INSPECTION_DATA);
    await propertiesModel.createRecord(db, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp();
    const res = await request(app)
      .patch(`/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect(201);

    // Get Result
    const {
      inspectionReportStatus,
      inspectionReportStatusChanged,
    } = res.body.data.attributes;

    // Assertions
    [
      {
        actual: inspectionReportStatus,
        expected: 'queued',
        msg: 'set record report status',
      },
      {
        actual: inspectionReportStatusChanged,
        notExpected: INSPECTION_DATA.inspectionReportStatusChanged,
        msg: 'set record report last update date',
      },
    ].forEach(({ actual, expected, notExpected, msg }) => {
      if (notExpected) {
        expect(actual).to.not.equal(expected, msg);
      } else {
        expect(actual).to.equal(expected, msg);
      }
    });
  });
});

function createApp() {
  const app = express();
  app.patch('/:inspectionId', handler(db, storage, stubs.createPublisher()));
  return app;
}
