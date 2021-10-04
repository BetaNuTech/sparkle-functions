const { expect } = require('chai');
const cors = require('cors');
const express = require('express');
const request = require('supertest');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const usersModel = require('../../../models/users');
const notificationsModel = require('../../../models/notifications');
const authUser = require('../../../utils/auth-firebase-user');
const getInspectionPDFHandler = require('../../../inspections/on-get-pdf-report');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, auth, deletePDFInspection } = require('../../setup');

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
    const inspDoc = await inspectionsModel.findRecord(fs, INSP_ID);
    const reportURL = (inspDoc.data() || {}).inspectionReportURL || '';

    // Delete any generated PDF
    if (reportURL) {
      try {
        await deletePDFInspection(reportURL);
      } catch (e) {} // eslint-disable-line no-empty
    }

    return cleanDb(null, fs);
  });

  it('should reject request without authorization', async function() {
    // Execute & Get Result
    const app = createApp(fs, auth, INSP_URL); // auth required when given
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
    await inspectionsModel.createRecord(fs, INSP_ID, inspData);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(fs, null, INSP_URL);
    return request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });

  it("should resolve an uploaded PDF's download link", async function() {
    // Setup database
    await inspectionsModel.createRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(fs, null, INSP_URL);
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
    await inspectionsModel.createRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirestore = await inspectionsModel.findRecord(fs, INSP_ID);

    // Assertions
    [
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
    await inspectionsModel.createRecord(fs, INSP_ID, inspData);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(fs, null, INSP_URL);
    const response = await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirestore = await inspectionsModel.findRecord(fs, INSP_ID);

    // Assertions
    [
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
    await inspectionsModel.createRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute
    const app = createApp(fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Result
    const resultFirestore = await inspectionsModel.findRecord(fs, INSP_ID);

    // Assertions
    [
      {
        actual: (resultFirestore.data() || {}).inspectionReportStatus || '',
        expected: final,
        msg: 'set firestore record report status',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should create notifications after successfully creating report', async function() {
    const userId = uuid();
    const expected = true; // Source notification exists
    const userData = {
      admin: true, // Add admin user
      firstName: 'test',
      lastName: 'user',
      email: 'test@email.com',
    };

    // Setup database
    await inspectionsModel.createRecord(fs, INSP_ID, INSPECTION_DATA);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);
    await usersModel.createRecord(fs, userId, userData);

    // Execute
    const app = createApp(
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
    const snap = await notificationsModel.findAll(fs);
    const actual = Boolean(snap.size);

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should return immediately when inspection status is generating', async function() {
    const inspData = {
      ...INSPECTION_DATA,
      inspectionReportStatus: 'generating',
    };

    // Setup database
    await inspectionsModel.createRecord(fs, INSP_ID, inspData);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute & Get Result
    const app = createApp(fs, null, INSP_URL);
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
    await inspectionsModel.createRecord(fs, INSP_ID, inspData);
    await propertiesModel.createRecord(fs, PROPERTY_ID, PROPERTY_DATA);

    // Execute, get result, and assertion
    const app = createApp(fs, null, INSP_URL);
    await request(app)
      .get(`/${PROPERTY_ID}/${INSP_ID}`)
      .set('Accept', 'application/json')
      .expect(304);
  });
});

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} fsDb - Firestore Admin DB instance
 * @param  {admin.auth?} fbAuth - Firebase Admin auth service instance (optional for testing)
 * @param  {String} inspectionUrl - template for an inspection's URL
 * @return {Function} - onRequest handler
 */
function createApp(fsDb, fbAuth, inspectionUrl) {
  // Create express app with single endpoint
  // that configures required url params
  const app = express();
  app.use(cors());
  const middleware = [
    fbAuth ? authUser(fsDb, fbAuth) : null,
    getInspectionPDFHandler(fsDb, inspectionUrl),
  ].filter(Boolean);
  app.get('/:property/:inspection', ...middleware);
  return app;
}
