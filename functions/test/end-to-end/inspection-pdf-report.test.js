const { expect } = require('chai');
const request = require('supertest');
const createApp = require('../../inspections/on-get-pdf-report');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db } = require('./setup');

describe('Inspection PDF Report', () => {
  afterEach(() => cleanDb(db));

  it('should resolve an uploaded PDF\'s download link', async function() {
    const inspId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const sectionId = uuid();
    const now = Date.now() / 1000;
    const inspection = {
      inspectorName: `author${propertyId}`,
      creationDate: now - 100000,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now,
      inspectionCompleted: true,
      score: 100,
      totalItems: 11,
      template: {
        name: `template${inspId}`,
        items: {
          [itemId]: {
            index: 0,
            isItemNA: false,
            isTextInputItem: true,
            mainInputFourValue: 0,
            mainInputOneValue: 0,
            mainInputSelected: true,
            mainInputThreeValue: 0,
            mainInputTwoValue: 0,
            mainInputZeroValue: 3,
            sectionId,
            textInputValue: '1',
            title: 'Unit #:'
          }
        },
        sections: {
          [sectionId]: {
            added_multi_section: false,
            index: 0,
            section_type: 'single',
            title: 'Intro'
          }
        }
      }
    };
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
