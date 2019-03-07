const { expect } = require('chai');
const request = require('supertest');
const createApp = require('../../inspections/on-get-pdf-report');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, auth } = require('./setup');

const {assign} = Object;

// Avoid creating lots of PDF's
const INSP_ID = uuid();
const PROPERTY_ID = uuid();
const SECTION_ID = uuid();
const INSPECTION_DATA = mocking.createInspection({
  property: PROPERTY_ID,
  score: 100,
  totalItems: 1,
  inspectionCompleted: true,
  template: {
    name: 'template',
    items: { [uuid()]: mocking.createItem({ sectionId: SECTION_ID }) },
    sections: { [SECTION_ID]: mocking.createSection() }
  }
});
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
  inspections: { [INSP_ID]: true }
};

describe('Inspection PDF Report', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without authorization', async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, {}, auth); // auth required when given
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });

  it('should resolve an uploaded PDF\'s download link', async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, { sendToDevice: () => Promise.resolve() });
    const result = await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    expect(result.body.inspectionReportURL).to.be.a('string');
  });

  it('should add an `inspectionReportUpdateLastDate` to inspection', async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute
    const app = createApp(db, { sendToDevice: () => Promise.resolve() });
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const actual = await db.ref(`/inspections/${INSP_ID}/inspectionReportUpdateLastDate`).once('value');

    // Assertions
    expect(actual.val()).to.be.a('number');
  });
});
