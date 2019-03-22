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

  it('should create overdue alert after 10+ days since creation date', async () => {
    const code = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const now = Date.now() / 1000;
    const nowDay = now / 60 / 60 / 24; // days since Unix Epoch
    const createdAt = (nowDay - 11) * 60 * 60 * 24; // 7 days ago in seconds
    const inspectionData = mocking.createInspection({
      property: propertyId,
      creationDate: createdAt,
      inspectionCompleted: true,
      completionDate: createdAt + 1000,
      score: 100, // avoid score alert
      template: { name: TEMP_NAME_LOOKUP }
    });
    const expected = `Blueshift Product Inspection OVERDUE (Last: ${moment(createdAt * 1000).format('MM/DD/YY')}, Completed: ${moment((createdAt + 1000) * 1000).format('MM/DD/YY')}).`;

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code: code});
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);

    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app).get(`/?cobalt_code=${code}`).expect(200);

    // Assertions
    const actual = response.body.alert;
    expect(actual).to.equal(expected, 'has overdue alert');
  });
});
