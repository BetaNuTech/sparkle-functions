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

    expect(response.text.toLowerCase()).to.have.string('missing parameters');
  });

  it('should reject request without property matching cobalt code', async function() {
    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get('/?cobalt_code=1')
      .expect(404)

    expect(response.text.toLowerCase()).to.have.string('not found');
  });

  it('should return latest completed inspection data', async function() {
    const code = uuid();
    const propertyId = uuid();
    const inspection1Id = uuid();
    const inspection2Id = uuid();
    const newest = (Date.now() / 1000);
    const oldest = (Date.now() / 1000) - 1000000;
    const inspectionBase = {property: propertyId, inspectionCompleted: true, template: { name: TEMP_NAME_LOOKUP }};
    const inspectionOne = mocking.createInspection(Object.assign({creationDate: newest}, inspectionBase));
    const inspectionTwo = mocking.createInspection(Object.assign({creationDate: oldest}, inspectionBase));
    const expectedDate = moment(inspectionOne.creationDate * 1000).format('MM/DD/YY');

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code});
    await db.ref(`/inspections/${inspection2Id}`).set(inspectionTwo);
    await db.ref(`/inspections/${inspection1Id}`).set(inspectionOne);

    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get(`/?cobalt_code=${code}`)
      .expect(200);

    expect(response.body.creationDate).to.equal(expectedDate, 'sent latest creation date');
  });
});
