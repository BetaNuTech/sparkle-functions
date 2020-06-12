const { expect } = require('chai');
const request = require('supertest');
const createApp = require('../../../inspections/on-get-pdf-report');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const usersModel = require('../../../models/users');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, auth, deletePDFInspection } = require('../../setup');

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

    return cleanDb(db, fs);
  });

  it('should reject request without authorization', async function() {
    // Execute & Get Result
    const app = createApp(db, fs, auth, INSP_URL); // auth required when given
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });

  it('should reject request for incompete inspection', async () => {
    const inspData = {
      ...INSPECTION_DATA,
      inspectionCompleted: false,
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, inspData);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(db, fs, null, INSP_URL);
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });

  it("should resolve an uploaded PDF's download link", async function() {
    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(db, fs, null, INSP_URL);
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
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(db, fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirebase = await inspectionsModel.findRecord(db, INSP_ID);
    const resultFirestore = await inspectionsModel.firestoreFindRecord(
      fs,
      INSP_ID
    );

    // Assertions
    [
      {
        actual:
          (resultFirebase.val() || {}).inspectionReportUpdateLastDate || 0,
        msg: 'set firebase inspection report update last date',
      },
      {
        actual:
          (resultFirestore.data() || {}).inspectionReportUpdateLastDate || 0,
        msg: 'set firestore inspection report update last date',
      },
    ].forEach(({ actual, msg }) => {
      expect(actual).to.be.a('number', msg);
      expect(actual).to.be.above(1, msg);
    });
  });

  it('should add an `inspectionReportURL` to inspection', async function() {
    const inspData = Object.assign({}, INSPECTION_DATA);
    delete inspData.inspectionReportURL;

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, inspData);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(db, fs, null, INSP_URL);
    const response = await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirebase = await inspectionsModel.findRecord(db, INSP_ID);
    const resultFirestore = await inspectionsModel.firestoreFindRecord(
      fs,
      INSP_ID
    );

    // Assertions
    [
      {
        actual: (resultFirebase.val() || {}).inspectionReportURL || '',
        expected: response.body.inspectionReportURL,
        msg: 'set firebase inspection report URL',
      },
      {
        actual: (resultFirestore.data() || {}).inspectionReportURL || '',
        expected: response.body.inspectionReportURL,
        msg: 'set firestore inspection report URL',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should update `inspectionReportStatus` on inspection', async function() {
    const final = 'completed_success';

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(db, fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirebase = await inspectionsModel.findRecord(db, INSP_ID);
    const resultFirestore = await inspectionsModel.firestoreFindRecord(
      fs,
      INSP_ID
    );

    // Assertions
    [
      {
        actual: (resultFirebase.val() || {}).inspectionReportStatus || '',
        expected: final,
        msg: 'set firebase record report status',
      },
      {
        actual: (resultFirestore.data() || {}).inspectionReportStatus || '',
        expected: final,
        msg: 'set firestore record report status',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should create a source notification after successfully creating report', async function() {
    const userId = uuid();
    const expected = true; // Source notification exists
    const userData = {
      admin: true, // Add admin user
      firstName: 'test',
      lastName: 'user',
      email: 'test@email.com',
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await usersModel.firestoreCreateRecord(fs, userId, userData);

    // Execute
    const app = createApp(
      db,
      fs,
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
    const inspData = {
      ...INSPECTION_DATA,
      inspectionReportStatus: 'generating',
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, inspData);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(db, fs, null, INSP_URL);
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
    const inspData = {
      ...INSPECTION_DATA,
      inspectionReportStatus: 'completed_success',
      inspectionReportUpdateLastDate: Math.round(Date.now() / 1000), // occured after
      updatedLastDate: Math.round((Date.now() - 1000) / 1000), // occured before
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, INSP_ID, inspData);
    await propertiesModel.firestoreCreateRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute, get result, and assertion
    const app = createApp(db, fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect(304);
  });

  it('should use firebase records when firestore records do not exist', async function() {
    const expected = 'completed_success';

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, INSP_ID, INSPECTION_DATA);
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(db, fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const result = await inspectionsModel.findRecord(db, INSP_ID);
    const actual = (result.val() || {}).inspectionReportStatus || '';

    // Assertions
    expect(actual).to.equal(expected);
  });
});
