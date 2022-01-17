const sinon = require('sinon');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const usersModel = require('../../../models/users');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const {
  fs: db,
  test,
  cloudFunctions,
  deletePDFInspection,
} = require('../../setup');

describe('Inspections | Pubsub | Generate Report PDF', function() {
  let cleanupInspId = '';
  afterEach(async () => {
    let reportURL = '';
    if (cleanupInspId) {
      try {
        const inspDoc = await inspectionsModel.findRecord(db, cleanupInspId);
        reportURL = inspDoc
          ? (inspDoc.data() || {}).inspectionReportURL || ''
          : '';
      } catch (e) {} // eslint-disable-line no-empty
      cleanupInspId = '';
    }

    // Delete any generated PDF
    if (reportURL) {
      try {
        await deletePDFInspection(reportURL);
      } catch (e) {} // eslint-disable-line no-empty
    }

    sinon.restore();
    await cleanDb(null, db);
  });

  it("should generate a completed inspection's report PDF", async function() {
    const propertyId = uuid();
    const inspectionId = uuid();
    cleanupInspId = inspectionId; // cleanup PDF after test
    const sectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      lastInspectionScore: 100,
      inspectionCompleted: true,
      updatedLastDate: 123456,
      template: mocking.createTemplate({
        sections: { [sectionId]: mocking.createSection() },
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false,
            { sectionId }
          ),
        },
      }),
    });
    const property = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [inspectionId],
    });
    const pubSubMessage = {
      data: Buffer.from(inspectionId),
    };

    // Setup database
    await inspectionsModel.createRecord(db, inspectionId, inspection);
    await propertiesModel.createRecord(db, propertyId, property);

    // Execute
    await test.wrap(cloudFunctions.generateReportPdf)(pubSubMessage);

    const resultSnap = await inspectionsModel.findRecord(db, inspectionId);
    const result = resultSnap.data() || {};

    // Get Result
    const {
      inspectionReportURL,
      inspectionReportStatus,
      inspectionReportUpdateLastDate,
    } = result;

    // Assertions
    [
      {
        actual: inspectionReportURL,
        expectedType: 'string',
        differentThan: inspection.inspectionReportURL,
        msg: 'updated record report URL',
      },
      {
        actual: inspectionReportStatus,
        expectedType: 'string',
        differentThan: inspection.inspectionReportStatus,
        expected: 'completed_success',
        msg: 'set record report status',
      },
      {
        actual: inspectionReportUpdateLastDate,
        expectedType: 'number',
        differentThan: inspection.inspectionReportUpdateLastDate,
        expected: inspection.updatedLastDate,
        msg: 'set record report last update date',
      },
    ].forEach(({ actual, expected, expectedType, differentThan, msg }) => {
      expect(actual).to.be.ok;
      expect(actual).to.be.a(expectedType, msg);
      expect(actual).to.not.equal(differentThan, msg);

      if (expected) {
        expect(actual).to.equal(expected);
      }
    });
  });

  it('should add a create an inspection pdf update notification when author provided', async function() {
    const expected = true;
    const authorId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    cleanupInspId = inspectionId; // cleanup PDF after test
    const sectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      lastInspectionScore: 100,
      inspectionCompleted: true,
      updatedLastDate: 123456,
      template: mocking.createTemplate({
        sections: { [sectionId]: mocking.createSection() },
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false,
            { sectionId }
          ),
        },
      }),
    });
    const property = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [inspectionId],
    });
    const user = mocking.createUser();
    const pubSubMessage = {
      data: Buffer.from(`${inspectionId}/${authorId}`),
    };

    // Setup database
    await usersModel.createRecord(db, authorId, user);
    await inspectionsModel.createRecord(db, inspectionId, inspection);
    await propertiesModel.createRecord(db, propertyId, property);

    // Execute
    await test.wrap(cloudFunctions.generateReportPdf)(pubSubMessage);

    // Get Results
    const resultSnap = await notificationsModel.query(db, {
      creator: ['==', authorId],
      property: ['==', propertyId],
    });
    const actual = resultSnap.size > 0; // has notification matching query

    // Assertions
    expect(actual).to.equal(expected);
  });
});
