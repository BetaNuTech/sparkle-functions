const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const fileUpload = require('express-fileupload');
const uuid = require('../../../test-helpers/uuid');
const storageHelper = require('../../../test-helpers/storage');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../properties/api/post-image');
const { cleanDb, findStorageFile } = require('../../../test-helpers/firebase');
const { fs, storage } = require('../../setup');

let uploadUrl = '';
describe('Properties | API | POST Image', () => {
  afterEach(async () => {
    await cleanDb(null, fs);

    if (uploadUrl) {
      await propertiesModel.deleteUpload(storage, uploadUrl);
    }
  });

  it("should add a property's profile image to storage and update the property record", async () => {
    const propertyId = uuid();
    const bucket = storage.bucket();
    const propertyData = mocking.createProperty();

    // Setup
    await propertiesModel.createRecord(fs, propertyId, propertyData);

    // Execute
    await request(createApp())
      .post(`/t/${propertyId}`)
      .attach('file', storageHelper.profileImagePath)
      .expect(201);

    // Test results
    const propertySnap = await propertiesModel.findRecord(fs, propertyId);
    const property = propertySnap.data() || {};
    expect(property.photoURL).to.be.ok;
    expect(property.photoName).to.be.ok;
    const actual = await findStorageFile(
      bucket,
      storageHelper.propertyUploadDir,
      property.photoName
    ); // find profile photo
    expect(actual).to.not.equal(undefined);
    uploadUrl = property.photoURL;
  });
});

function createApp() {
  const app = express();
  app.post('/t/:propertyId', stubAuth, fileUpload(), handler(fs, storage));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
