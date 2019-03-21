const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../inspections/get-latest-completed');
const { cleanDb } = require('../../test-helpers/firebase');
const { db } = require('./setup');

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

  it('should reject request when property has no completed inspections', async function() {
    const code = uuid();
    const propertyId = uuid();

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({name: `test${propertyId}`, code});

    // Execute & Get Result
    const app = createApp(db);
    const response = await request(app)
      .get(`/?cobalt_code=${code}`)
      .expect(404)

    expect(response.text.toLowerCase()).to.have.string('no inspections exist');
  });
});
