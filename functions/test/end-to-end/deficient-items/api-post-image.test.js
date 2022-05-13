const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const fileParser = require('express-multipart-file-parser');
const uuid = require('../../../test-helpers/uuid');
const storageHelper = require('../../../test-helpers/storage');
const mocking = require('../../../test-helpers/mocking');
const deficiencyModel = require('../../../models/deficient-items');
const storageService = require('../../../services/storage');
const handler = require('../../../deficient-items/api/post-image');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const { db, storage } = require('../../setup');

let fileName = '';
const PROPERTY_ID = uuid();
const DEF_ITEM_ID = uuid();

describe('Deficient Items | API | POST Image', () => {
  afterEach(async () => {
    await cleanDb(db);

    if (fileName) {
      await storageService.deleteDeficientItemPhoto(
        storage,
        PROPERTY_ID,
        DEF_ITEM_ID,
        fileName
      );
    }
  });

  it("should add an deficient item's image to storage", async () => {
    const deficiency = mocking.createDeficiency({
      inspection: uuid(),
      property: PROPERTY_ID,
      item: uuid(),
    });
    const bucket = storage.bucket();

    // Setup
    await deficiencyModel.createRecord(db, DEF_ITEM_ID, deficiency);

    // Execute
    const res = await request(createApp())
      .post(`/t/${DEF_ITEM_ID}`)
      .attach('file', storageHelper.profileImagePath)
      .expect(201);

    // Test results
    const result = res.body.data || {};
    const photoDataId = result.id || '';
    const ext = storageHelper.profileImagePath.split('.').pop();
    fileName = `${photoDataId}.${ext}`;
    const filePath = `${PROPERTY_ID}/${DEF_ITEM_ID}/${fileName}`;
    const actual = await findStorageFile(
      bucket,
      storageHelper.deficientItemUploadDir,
      filePath
    ); // find photo data entry
    expect(actual).to.not.equal(undefined);
  });
});

function createApp() {
  const app = express();
  app.post('/t/:deficiencyId', stubAuth, fileParser, handler(db, storage));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
