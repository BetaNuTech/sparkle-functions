const { expect } = require('chai');
const request = require('supertest');
const createApp = require('../../../inspections/on-get-pdf-report');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, auth, deletePDFInspection } = require('../setup');

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
    sections: { [SECTION_ID]: mocking.createSection() },
  },
});
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
  inspections: { [INSP_ID]: true },
};
const INSP_URL = '{{propertyId}}/{{inspectionId}}';

describe('Inspections | PDF Report', () => {
  afterEach(async () => {
    const reportURL = await db
      .ref(`/inspections/${INSP_ID}/inspectionReportURL`)
      .once('value');

    // Delete any generated PDF
    if (reportURL.val()) {
      try {
        await deletePDFInspection(reportURL.val());
      } catch (e) {} // eslint-disable-line no-empty
    }

    return cleanDb(db);
  });

  it('should reject request without authorization', async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, auth, INSP_URL); // auth required when given
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });

  it('should reject request for incompete inspection', async () => {
    // Setup database
    await db
      .ref(`/inspections/${INSP_ID}`)
      .set(Object.assign({}, INSPECTION_DATA, { inspectionCompleted: false }));
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, null, INSP_URL);
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });

  it("should resolve an uploaded PDF's download link", async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, null, INSP_URL);
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
    const app = createApp(db, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const actual = await db
      .ref(`/inspections/${INSP_ID}/inspectionReportUpdateLastDate`)
      .once('value');

    // Assertions
    expect(actual.val()).to.be.a('number');
  });

  it('should add an `inspectionReportURL` to inspection', async function() {
    // Setup database
    const inspectionData = Object.assign({}, INSPECTION_DATA);
    delete inspectionData.inspectionReportURL;
    await db.ref(`/inspections/${INSP_ID}`).set(inspectionData); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute
    const app = createApp(db, null, INSP_URL);
    const response = await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const actual = await db
      .ref(`/inspections/${INSP_ID}/inspectionReportURL`)
      .once('value');
    const expected = response.body.inspectionReportURL;

    // Assertions
    expect(actual.val()).to.equal(expected);
  });

  it('should update `inspectionReportStatus` on inspection', async function() {
    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute
    const app = createApp(db, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const actual = await db
      .ref(`/inspections/${INSP_ID}/inspectionReportStatus`)
      .once('value');

    // Assertions
    expect(actual.val()).to.equal('completed_success');
  });

  it('should create a source notification after successfully creating report', async function() {
    const userId = uuid();
    const expected = true; // Source notification exists

    // Setup database
    await db.ref(`/inspections/${INSP_ID}`).set(INSPECTION_DATA); // Add inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property
    await db.ref(`/users/${userId}`).set({
      admin: true, // Add admin user
      firstName: 'test',
      lastName: 'user',
      email: 'test@email.com',
    });

    // Execute
    const app = createApp(
      db,
      {
        verifyIdToken: () => Promise.resolve({ uid: userId }),
      },
      INSP_URL
    );
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Authorization', 'fb-jwt 1234')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const snap = await db.ref('/notifications/src').once('value');
    const actual = snap.exists();

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should return immediately when inspection status is generating', async function() {
    // Setup database
    const inspectionData = Object.assign({}, INSPECTION_DATA, {
      inspectionReportStatus: 'generating',
    });
    await db.ref(`/inspections/${INSP_ID}`).set(inspectionData); // Add generating inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = createApp(db, null, INSP_URL);
    const result = await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    expect(result.body.status).to.equal('generating');
    expect(result.body.message).to.include('is being generated');
  });

  it('should return immediately when inspection report up to date', async function() {
    // Setup database
    const inspectionData = Object.assign({}, INSPECTION_DATA, {
      inspectionReportStatus: 'completed_success',
      inspectionReportUpdateLastDate: Date.now() / 1000, // occured after
      updatedLastDate: (Date.now() - 1000) / 1000, // occured before
    });
    await db.ref(`/inspections/${INSP_ID}`).set(inspectionData); // Add generating inspection
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute, get result, and assertion
    const app = createApp(db, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect(304);
  });
});
