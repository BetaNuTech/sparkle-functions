const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/get-latest-completed');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

const UNIX_DAY = 86400;
const TODAY_UNIX = Math.round(Date.now() / 1000) - 1000;
const YESTURDAY_UNIX = TODAY_UNIX - UNIX_DAY;
const TWO_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 2;
const THREE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 3;
const FOUR_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 4;
const FIVE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 5;

describe('Inspections | API | GET Latest Completed', () => {
  afterEach(() => cleanDb(db));

  it('returns latest completed inspection', async () => {
    const expected = uuid();
    const insp1Data = createInspection({
      completionDate: YESTURDAY_UNIX, // latest
    });
    const insp2Data = createInspection({
      completionDate: TWO_DAYS_AGO_UNIX, // 2nd latest
    });
    const insp3Data = createInspection({
      completionDate: THREE_DAYS_AGO_UNIX, // 3rd latest
    });

    // Setup database
    await inspectionsModel.createRecord(db, uuid(), insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);
    await inspectionsModel.createRecord(db, expected, insp1Data);

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

  it('returns latest completed inspection scoped to a property code', async () => {
    const propertyCode = 'test';
    const propertyId = uuid();
    const expected = uuid();
    const propertyData = createProperty({ code: propertyCode });
    const insp1Data = createInspection({
      property: uuid(),
      completionDate: YESTURDAY_UNIX, // latest for all
    });
    const insp2Data = createInspection({
      property: propertyId,
      completionDate: TWO_DAYS_AGO_UNIX, // latest for property
    });
    const insp3Data = createInspection({
      property: propertyId,
      completionDate: THREE_DAYS_AGO_UNIX, // 2nd latest for property
    });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, uuid(), insp1Data);
    await inspectionsModel.createRecord(db, expected, insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(`/t?propertyCode=${propertyCode}`)
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });

  it('returns latest completed inspection scoped to a template name', async () => {
    const templateName = 'test 1000 abc';
    const expected = uuid();
    const insp1Data = createInspection({
      completionDate: YESTURDAY_UNIX, // latest for all
    });
    const insp2Data = createInspection({
      templateName,
      completionDate: TWO_DAYS_AGO_UNIX, // latest for template name
    });
    const insp3Data = createInspection({
      templateName,
      completionDate: THREE_DAYS_AGO_UNIX, // 2nd latest for template name
    });

    // Setup database
    await inspectionsModel.createRecord(db, uuid(), insp1Data);
    await inspectionsModel.createRecord(db, expected, insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(`/t?templateName=${encodeURI(templateName)}`)
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });

  it('returns latest completed inspection before a specified time', async () => {
    const expected = uuid();
    const insp1Data = createInspection({
      completionDate: YESTURDAY_UNIX,
    });
    const insp2Data = createInspection({
      completionDate: THREE_DAYS_AGO_UNIX, // latest before time
    });
    const insp3Data = createInspection({
      completionDate: FOUR_DAYS_AGO_UNIX, // 2nd latest before time
    });

    // Setup database
    await inspectionsModel.createRecord(db, uuid(), insp1Data);
    await inspectionsModel.createRecord(db, expected, insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(`/t?before=${TWO_DAYS_AGO_UNIX}`)
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });

  it('returns latest completed inspection scoped to a property code and template name', async () => {
    const propertyCode = 'test';
    const templateName = 'test 1000 abc';
    const propertyId = uuid();
    const expected = uuid();
    const propertyData = createProperty({ code: propertyCode });
    const insp1Data = createInspection({
      property: uuid(),
      completionDate: YESTURDAY_UNIX, // latest for all
    });
    const insp2Data = createInspection({
      property: propertyId,
      templateName,
      completionDate: FOUR_DAYS_AGO_UNIX, // latest for property & template
    });
    const insp3Data = createInspection({
      property: propertyId,
      templateName,
      completionDate: FIVE_DAYS_AGO_UNIX, // 2nd latest for property & template
    });
    const insp4Data = createInspection({
      property: propertyId,
      completionDate: TWO_DAYS_AGO_UNIX, // latest for property
    });
    const insp5Data = createInspection({
      templateName,
      completionDate: THREE_DAYS_AGO_UNIX, // latest for template name
    });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, uuid(), insp1Data);
    await inspectionsModel.createRecord(db, expected, insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);
    await inspectionsModel.createRecord(db, uuid(), insp4Data);
    await inspectionsModel.createRecord(db, uuid(), insp5Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(
        `/t?propertyCode=${propertyCode}&templateName=${encodeURI(
          templateName
        )}`
      )
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });

  it('returns latest completed inspection scoped to a property code, template name, and before a time', async () => {
    const propertyCode = 'test';
    const templateName = 'test 1000 abc';
    const propertyId = uuid();
    const expected = uuid();
    const propertyData = createProperty({ code: propertyCode });
    const insp1Data = createInspection({
      property: uuid(),
      completionDate: YESTURDAY_UNIX, // latest for all
    });
    const insp2Data = createInspection({
      templateName,
      property: propertyId,
      completionDate: THREE_DAYS_AGO_UNIX, // latest for property, template, & time
    });
    const insp3Data = createInspection({
      templateName,
      property: propertyId,
      completionDate: TWO_DAYS_AGO_UNIX, // Too soon for property & template
    });
    const insp4Data = createInspection({
      property: propertyId,
      completionDate: TWO_DAYS_AGO_UNIX, // latest for property
    });
    const insp5Data = createInspection({
      templateName,
      completionDate: TWO_DAYS_AGO_UNIX, // latest for template name
    });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propertyData);
    await inspectionsModel.createRecord(db, uuid(), insp1Data);
    await inspectionsModel.createRecord(db, expected, insp2Data);
    await inspectionsModel.createRecord(db, uuid(), insp3Data);
    await inspectionsModel.createRecord(db, uuid(), insp4Data);
    await inspectionsModel.createRecord(db, uuid(), insp5Data);

    // Execute
    const app = createApp();
    const { body: result } = await request(app)
      .get(
        `/t?before=${TWO_DAYS_AGO_UNIX}&propertyCode=${propertyCode}&templateName=${encodeURI(
          templateName
        )}`
      )
      .send()
      .expect(200);

    // Assertions
    const actual = result && result.data ? result.data.id || '' : '';
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.get('/t', handler(db));
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
    templateName: 'Test',
    template: { name: 'Test' },
    inspectionReportURL: 'https://test.com/img.pdf',
    ...inspConfig,
  };
}
