const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const storageHelper = require('../../../test-helpers/storage');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const storageService = require('../../../services/storage');
const handler = require('../../../inspections/api/patch-template');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const { fs: db, storage, deletePDFInspection } = require('../../setup');

describe('Inspections | API | PATCH Template', () => {
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

  it('should update a inspection record', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      inspectionReportURL: 'old-url.com',
      inspectionReportUpdateLastDate: 1601494027,
      inspectionCompleted: true,
      templateName: 'template',
      template: mocking.createTemplate({
        name: 'template',
        items: { [itemId]: mocking.createItem({ sectionId }) },
        sections: { [sectionId]: mocking.createSection() },
      }),
    });
    const update = {
      items: {
        [itemId]: {
          textInputValue: 'New valid value',
        },
      },
    };
    const expected = JSON.parse(JSON.stringify(inspection));
    expected.template.items[itemId].textInputValue =
      update.items[itemId].textInputValue;

    // Setup database
    await inspectionsModel.createRecord(db, inspectionId, inspection);

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}/template?report=false`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const updatedInspection = await inspectionsModel.findRecord(
      db,
      inspectionId
    );

    // Assertions
    const actual = updatedInspection.data() || null;
    delete actual.updatedAt;
    expect(actual).to.deep.equal(expected);
  });

  it('should cleanup an inspection items photos when it gets deleted', async () => {
    const expected = undefined;
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const deletedSectionId = uuid();
    const itemId = uuid();
    const deletedItemId = uuid();
    const bucket = storage.bucket();
    const sectionConfig = { title: 'Multi', section_type: 'multi' };
    const fileName = `${Math.round(Date.now() / 1000)}`;

    const fileBuffer = await storageHelper.createFileBuffer();
    const url = await storageService.inspectionItemUpload(
      storage,
      fileBuffer,
      inspectionId,
      deletedItemId,
      fileName,
      'jpg'
    );
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 100,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      inspectionReportURL: 'old-url.com',
      inspectionReportUpdateLastDate: 1601494027,
      inspectionCompleted: true,
      templateName: 'template',
      template: mocking.createTemplate({
        name: 'template',
        items: {
          [itemId]: mocking.createItem({ sectionId }),
          [deletedItemId]: mocking.createItem({
            sectionId: deletedSectionId,
            photosData: {
              [uuid()]: mocking.createInspectionItemPhotoData({
                downloadURL: url,
              }),
            },
          }),
        },
        sections: {
          [sectionId]: mocking.createSection(sectionConfig), // original section
          [deletedSectionId]: mocking.createSection({
            // cloned multi-section
            ...sectionConfig,
            index: 1,
            added_multi_section: true,
          }),
        },
      }),
    });
    const update = {
      sections: {
        [deletedSectionId]: null,
      },
    };

    // Setup database
    await inspectionsModel.createRecord(db, inspectionId, inspection);

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}/template?report=false`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Check that deleted section and
    // its' items are completely removed from record
    const resultSnap = await inspectionsModel.findRecord(db, inspectionId);
    const result = resultSnap.data();
    const sectionIds = Object.keys(result.template.sections || {});
    const itemIds = Object.keys(result.template.items || {});
    expect(sectionIds).to.deep.equal(
      [sectionId],
      'removed deleted section reference'
    );
    expect(itemIds).to.deep.equal([itemId], 'removed deleted item reference');

    // Test results
    const directory = storageService.getInspectionItemUploadDir(
      inspectionId,
      deletedItemId
    );
    const actual = await findStorageFile(bucket, directory, `${fileName}.jpg`); // find the upload
    expect(actual).to.equal(expected, 'removed deleted item photos');
  });

  it('should update property meta data when the inspection becomes complete', async () => {
    const unexpected = 0;
    const propertyId = uuid();
    const inspectionId = uuid();
    cleanupInspId = inspectionId; // cleanup PDF after test
    const sectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      score: 0,
      totalItems: 1,
      itemsCompleted: 0,
      deficienciesExist: false,
      lastInspectionScore: unexpected,
      inspectionCompleted: false,
      updatedLastDate: 0,
      template: mocking.createTemplate({
        sections: { [sectionId]: mocking.createSection() },
        items: {
          [itemId]: mocking.createIncompleteMainInputItem(
            'twoactions_checkmarkx',
            { sectionId }
          ),
        },
      }),
    });

    // Complete inspection
    const update = {
      items: {
        [itemId]: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    };

    // Creating property to test meta data changes
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [inspectionId],
    });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propData); // Required
    await inspectionsModel.createRecord(db, inspectionId, inspection);

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}/template?report=false`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get results
    const propertySnap = await propertiesModel.findRecord(db, propertyId);
    const result = propertySnap.data() || null;

    // Assertions
    const actual = result.lastInspectionScore;
    expect(actual).to.not.equal(unexpected);
  });

  // it("should generate a new completed inspection's report after on success", async function() {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   cleanupInspId = inspectionId; // cleanup PDF after test
  //   const sectionId = uuid();
  //   const itemId = uuid();
  //   const inspection = mocking.createInspection({
  //     property: propertyId,
  //     score: 0,
  //     totalItems: 1,
  //     itemsCompleted: 0,
  //     deficienciesExist: false,
  //     lastInspectionScore: 0,
  //     inspectionCompleted: false,
  //     updatedLastDate: 0,
  //     inspectionReportURL: 'old-report.pdf',
  //     inspectionReportStatus: 'completed_failure',
  //     inspectionReportUpdateLastDate: 1,
  //     template: mocking.createTemplate({
  //       sections: { [sectionId]: mocking.createSection() },
  //       items: {
  //         [itemId]: mocking.createIncompleteMainInputItem(
  //           'twoactions_checkmarkx',
  //           { sectionId }
  //         ),
  //       },
  //     }),
  //   });
  //   const property = mocking.createProperty({
  //     name: `name${propertyId}`,
  //     inspections: [inspectionId],
  //   });

  //   // Complete inspection
  //   const update = {
  //     items: {
  //       [itemId]: {
  //         mainInputSelected: true,
  //         mainInputSelection: 0,
  //       },
  //     },
  //   };

  //   // Setup database
  //   await inspectionsModel.createRecord(db, inspectionId, inspection);
  //   await propertiesModel.createRecord(db, propertyId, property);

  //   // Stubs
  //   const updateCalls = sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .callThrough();

  //   // Execute
  //   await request(createApp())
  //     .patch(`/t/${inspectionId}/template`)
  //     .send(update)
  //     .expect('Content-Type', /json/)
  //     .expect(201);

  //   // Report is created after response sent
  //   // await for inspection to be updated to
  //   // signal report has been uploaded
  //   while (updateCalls.callCount < 2) {
  //     await new Promise(r => setTimeout(r, 500));
  //   }
  //   const resultSnap = await inspectionsModel.findRecord(db, inspectionId);
  //   const result = resultSnap.data() || {};

  //   // Get Result
  //   const {
  //     inspectionReportURL,
  //     inspectionReportStatus,
  //     inspectionReportUpdateLastDate,
  //   } = result;

  //   // Assertions
  //   [
  //     {
  //       actual: inspectionReportURL,
  //       expectedType: 'string',
  //       differentThan: inspection.inspectionReportURL,
  //       msg: 'updated record report URL',
  //     },
  //     {
  //       actual: inspectionReportStatus,
  //       expectedType: 'string',
  //       differentThan: inspection.inspectionReportStatus,
  //       expected: 'completed_success',
  //       msg: 'set record report status',
  //     },
  //     {
  //       actual: inspectionReportUpdateLastDate,
  //       expectedType: 'number',
  //       differentThan: inspection.inspectionReportUpdateLastDate,
  //       msg: 'set record report last update date',
  //     },
  //   ].forEach(({ actual, expected, expectedType, differentThan, msg }) => {
  //     expect(actual).to.be.ok;
  //     expect(actual).to.be.a(expectedType, msg);
  //     expect(actual).to.not.equal(differentThan, msg);

  //     if (expected) {
  //       expect(actual).to.equal(expected);
  //     }
  //   });
  // });
});

function createApp(user = {}) {
  const app = express();
  app.patch(
    '/t/:inspectionId/template',
    bodyParser.json(),
    stubAuth(user),
    handler(db, storage)
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: uuid() }, user);
    next();
  };
}
