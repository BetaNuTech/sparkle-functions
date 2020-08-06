const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const config = require('../../../config');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/get-latest-completed');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');

const BLUESHIFT_TEMPLATE = config.inspections.blueshiftTemplateName;
const UNIX_DAY = 86400;
const TODAY_UNIX = Math.round(Date.now() / 1000);
const YESTURDAY_UNIX = TODAY_UNIX - UNIX_DAY;
const TWO_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 2;
const THREE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 3;

describe('Inspections | API | GET Latest Completed', () => {
  afterEach(() => cleanDb(null, fs));

  it('returns latest completed inspection', async () => {
    const propertyCode = 'test';
    const propertyId = uuid();
    const expected = uuid();
    const insp2Id = uuid();
    const propertyData = createProperty({ code: propertyCode });
    const insp1Data = createInspection({
      property: propertyId,
      creationDate: YESTURDAY_UNIX,
    });
    const insp2Data = createInspection({
      property: propertyId,
      creationDate: TWO_DAYS_AGO_UNIX,
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, expected, insp1Data);
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, insp2Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get('/t')
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });

  it('returns latest completed inspection by other date', async () => {
    const propertyCode = 'test';
    const propertyId = uuid();
    const insp1Id = uuid();
    const expected = uuid();
    const propertyData = createProperty({ code: propertyCode });
    const insp1Data = createInspection({
      property: propertyId,
      creationDate: YESTURDAY_UNIX,
    });
    const insp2Data = createInspection({
      property: propertyId,
      creationDate: THREE_DAYS_AGO_UNIX,
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, insp1Data);
    await inspectionsModel.firestoreCreateRecord(fs, expected, insp2Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(`/t?other_date=${TWO_DAYS_AGO_UNIX}`)
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.included ? result.included[0].id || '' : '';
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.get('/t', handler(fs));
  return app;
}

function createProperty(propConfig = {}) {
  return {
    name: 'test',
    ...propConfig,
  };
}

function createInspection(inspConfig = {}) {
  const timestamp = TODAY_UNIX;

  return {
    property: uuid(),
    inspectionCompleted: true,
    creationDate: timestamp,
    completionDate: timestamp + 5000,
    score: 100,
    templateName: `Test - ${BLUESHIFT_TEMPLATE}`,
    template: { name: `Test - ${BLUESHIFT_TEMPLATE}` },
    inspectionReportURL: 'https://test.com/img.pdf',
    ...inspConfig,
  };
}
