const { expect } = require('chai');
const moment = require('moment');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../inspections/get-latest-completed');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db } = require('./setup');

const TEMP_NAME_LOOKUP = 'Blueshift Product Inspection';

describe('Latest Complete Inspection', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without cobalt code', async function() {
    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get('/')
      .expect(400);

    // Assertions
    expect(response.text.toLowerCase()).to.have.string('missing parameters');
  });

  it('should reject request without property matching cobalt code', async function() {
    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get('/?cobalt_code=1')
      .expect(404)

    // Assertions
    expect(response.text.toLowerCase()).to.have.string('not found');
  });

  it('should return latest completed inspection data', async function() {
    const code = uuid();
    const propertyId = uuid();
    const inspection1Id = uuid();
    const inspection2Id = uuid();
    const newest = (Date.now() / 1000);
    const oldest = (Date.now() / 1000) - 1000000;
    const expected = {creationDate: newest, completionDate: newest + 1000, score: 95, inspectionReportURL: 'google.com'}
    const inspectionBase = {property: propertyId, inspectionCompleted: true, completionDate: expected.completionDate, template: { name: TEMP_NAME_LOOKUP }};
    const latestInspection = mocking.createInspection(Object.assign({}, expected, inspectionBase));
    const oldestInspection = mocking.createInspection(Object.assign({creationDate: oldest}, inspectionBase));
    const expectedCreationDate = moment(expected.creationDate * 1000).format('MM/DD/YY');
    const expectedCompletionDate = moment(expected.completionDate * 1000).format('MM/DD/YY');
    const expectedScore = `${expected.score}%`;
    const expectedUrl = expected.inspectionReportURL;

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code});
    await db.ref(`/inspections/${inspection2Id}`).set(oldestInspection);
    await db.ref(`/inspections/${inspection1Id}`).set(latestInspection);

    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get(`/?cobalt_code=${code}`)
      .expect(200);

    // Assertions
    expect(response.body.creationDate).to.equal(expectedCreationDate, 'latest creation date');
    expect(response.body.completionDate).to.equal(expectedCompletionDate, 'latest completion date');
    expect(response.body.score).to.equal(expectedScore, 'latest score');
    expect(response.body.inspectionReportURL).to.equal(expectedUrl, 'latest report URL');
    expect(response.body.inspectionURL).to.have.string(propertyId, 'latest app URL has property ID');
    expect(response.body.inspectionURL).to.have.string(inspection1Id, 'latest app URL has latest inspection ID');
  });

  it('should create overdue alert when inspection dates meet criteria', async () => {
    const code = uuid();
    const propertyId = uuid();
    const nowDay = unixToUnixDays(Date.now() / 1000); // days since Unix Epoch
    const inspectionBase = {property: propertyId, inspectionCompleted: true, score: 100, template: { name: TEMP_NAME_LOOKUP }};

    const insp1Data = mocking.createInspection(Object.assign({}, {
      completionDate: unixDaysToUnix(nowDay - 9), // 9 days ago in seconds
      creationDate: unixDaysToUnix(nowDay - 11), // 11 days ago in seconds
    }, inspectionBase));
    const insp2Data = mocking.createInspection(Object.assign({}, {
      completionDate: unixDaysToUnix(nowDay - 4), // 4 days ago in seconds
      creationDate: unixDaysToUnix(nowDay - 6), // 6 days ago in seconds
    }, inspectionBase));
    const insp3Data = mocking.createInspection(Object.assign({}, {
      completionDate: unixDaysToUnix(nowDay - 2), // 2 days ago in seconds
      creationDate: unixDaysToUnix(nowDay - 20), // 20 days ago in seconds
    }, inspectionBase));

    const inspections = [
      {
        data: insp1Data,
        expected: createOverdueAlertMsg(insp1Data),
        message: 'has overdue alert when completed > 3 days ago & created > 10 days ago'
      },
      {
        data: insp2Data,
        expected: '',
        message: 'has no overdue alert when completed > 3 days ago & created < 10 days ago'
      },
      {
        data: insp3Data,
        expected: '',
        message: 'has no overdue alert when completed < 3 days ago'
      }
    ];

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code: code});

    for (let i = 0; i < inspections.length; i++) {
      const {data, expected, message} = inspections[i];
      await db.ref(`/inspections/${uuid()}`).set(data);

      // Execute & Get Result
      const app = createApp(db);
      const response = await request(app).get(`/?cobalt_code=${code}`).expect(200);

      // Assertions
      expect(response.body.alert).to.equal(expected, `alert: ${message}`);
      expect(response.body.complianceAlert).to.equal(expected, `compliance alert: ${message}`);
    }
  });

  it('should alert 3-day max after 3+ days between creation and completion', async () => {
    const code = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const nowDay = unixToUnixDays(Date.now() / 1000); // days since Unix Epoch
    const completedDay = nowDay - 11
    const createdDay = completedDay - 4;
    const createdAt = unixDaysToUnix(createdDay); // 14 days ago in seconds
    const completedAt = unixDaysToUnix(completedDay); // 11 days ago in seconds
    const inspectionData = mocking.createInspection({
      property: propertyId,
      creationDate: createdAt,
      inspectionCompleted: true,
      completionDate: completedAt,
      score: 100, // avoid score alert
      template: { name: TEMP_NAME_LOOKUP }
    });
    const expected = `Blueshift Product Inspection OVERDUE (Last: ${moment(createdAt * 1000).format('MM/DD/YY')}, Completed: ${moment(completedAt * 1000).format('MM/DD/YY')}). Over 3-day max duration, please start and complete inspection within 3 days.`;

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code: code});
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);

    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app).get(`/?cobalt_code=${code}`).expect(200);

    // Assertions
    const actual = response.body.alert;
    expect(actual).to.equal(expected, 'has 3-day max alert');
  });
});

// Helpers

function createOverdueAlertMsg(inspection) {
  return `Blueshift Product Inspection OVERDUE (Last: ${moment(inspection.creationDate * 1000).format('MM/DD/YY')}, Completed: ${moment((inspection.completionDate + 1000) * 1000).format('MM/DD/YY')}).`;
}

function unixDaysToUnix(unixDays) {
  return unixDays * 60 * 60 * 24;
}

function unixToUnixDays(unix) {
  return unix / 60 / 60 / 24; // days since Unix Epoch
}
