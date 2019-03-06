const { expect } = require('chai');
const request = require('supertest');
const createApp = require('../../inspections/on-get-pdf-report');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, auth } = require('./setup');

const {assign} = Object;

describe('Inspection PDF Report', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without authorization', async function() {
    const inspId = uuid();
    const propertyId = uuid();

    // Setup database
    await db.ref(`/inspections/${inspId}`).set({}); // Add inspection
    await db.ref(`/properties/${propertyId}`).set({}); // Add property

    // Execute & Get Result
    const app = createApp(db, {}, auth);
    return request(app)
      .get(`/${propertyId}/${inspId}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });

  it('should resolve an uploaded PDF\'s download link', async function() {
    const inspId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const sectionId = uuid();
    const now = Date.now() / 1000;
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      inspectionCompleted: true,
      template: {
        name: `template${inspId}`,
        items: { [itemId]: mocking.createItem({ sectionId }) },
        sections: { [sectionId]: mocking.createSection() }
      }
    });
    const property = {
      name: `name${propertyId}`,
      inspections: { [inspId]: true }
    };

    // Setup database
    await db.ref(`/inspections/${inspId}`).set(inspection); // Add inspection
    await db.ref(`/properties/${propertyId}`).set(property); // Add property

    // Execute & Get Result
    const app = createApp(db, { sendToDevice: () => Promise.resolve() });
    const result = await request(app)
      .get(`/${propertyId}/${inspId}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    expect(result.body.inspectionReportURL).to.be.a('string');
  });
});
