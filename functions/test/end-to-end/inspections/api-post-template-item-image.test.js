const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const fileParser = require('express-multipart-file-parser');
const uuid = require('../../../test-helpers/uuid');
const storageHelper = require('../../../test-helpers/storage');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const storageService = require('../../../services/storage');
const handler = require('../../../inspections/api/post-template-item-image');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const { fs: db, storage } = require('../../setup');

let fileName = '';
const INSPECTION_ID = uuid();
const ITEM_ID = uuid();

describe('Inspections | API | POST Template Item Image', () => {
  afterEach(async () => {
    await cleanDb(null, db);

    if (fileName) {
      await storageService.deleteInspectionItemPhotoEntry(
        storage,
        INSPECTION_ID,
        ITEM_ID,
        fileName
      );
    }
  });

  it("should add an inspection item's image to storage", async () => {
    const sectionId = uuid();
    const inspection = mocking.createInspection({
      property: uuid(),
      template: mocking.createTemplate({
        name: 'template',
        items: { [ITEM_ID]: mocking.createItem({ sectionId }) },
        sections: { [sectionId]: mocking.createSection() },
      }),
    });
    const bucket = storage.bucket();

    // Setup
    await inspectionsModel.createRecord(db, INSPECTION_ID, inspection);

    // Execute
    const res = await request(createApp())
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
      .attach('file', storageHelper.profileImagePath)
      .expect(201);

    // Test results
    const result = res.body.data || {};
    const photoDataId = result.id || '';
    const ext = storageHelper.profileImagePath.split('.').pop();
    fileName = `${photoDataId}.${ext}`;
    const filePath = `${INSPECTION_ID}/${ITEM_ID}/${fileName}`;
    const actual = await findStorageFile(
      bucket,
      storageHelper.inspectionUploadDir,
      filePath
    ); // find photo data entry
    expect(actual).to.not.equal(undefined);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:inspectionId/:itemId',
    stubAuth,
    fileParser,
    handler(db, storage)
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
