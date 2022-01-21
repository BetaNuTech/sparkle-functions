const request = require('supertest');
const { expect } = require('chai');
const path = require('path');
const express = require('express');
const fileParser = require('express-multipart-file-parser');
const sinon = require('sinon');
const imageUtil = require('../../../utils/images');
const storage = require('../../../services/storage');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../properties/api/post-image');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const SRC_PROFILE_IMG = 'test-image.jpg';
const IMG_PATH = path.join(__dirname, `../../end-to-end/${SRC_PROFILE_IMG}`);
const PROPERTY_ID = uuid();

describe('Properties | API | POST Image', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request missing file payload', async () => {
    const expected = 'missing "file"';

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.contain(expected);
  });

  it('rejects request with invalid property upload target', async () => {
    const expected = 'target';

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}?target=nope`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.contain(expected);
  });

  it('rejects request with unsupported image type', async () => {
    const expected = 'mime';

    // Stubs
    sinon.stub(imageUtil, 'getMimeType').returns('');

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.contain(expected);
  });

  it('rejects request to update property with non-existent property', async () => {
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request with unsupported image type', async () => {
    const expected = 'mime';

    // Stubs
    sinon.stub(imageUtil, 'getMimeType').returns('');

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.contain(expected);
  });

  it('successfully updates a property profile image', async () => {
    const property = mocking.createProperty();
    const expected = {
      photoURL: 'google.com/image.jpg',
      photoName: `${PROPERTY_ID}.jpg`,
    };

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon.stub(imageUtil, 'createImage').resolves(Buffer.from([]));
    sinon.stub(imageUtil, 'optimizeImage').resolves(Buffer.from([]));
    sinon.stub(storage, 'propertyUpload').resolves(expected.photoURL);
    sinon.stub(propertiesModel, 'updateRecord').resolves();

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = res.body.data || {};
    const actual = result.attributes || {};
    expect(actual).to.deep.equal(expected);
  });

  it('successfully updates a property logo along with the banner image', async () => {
    const property = mocking.createProperty();
    const expected = {
      logoURL: 'google.com/image_logo.jpg',
      logoName: `${PROPERTY_ID}_logo.jpg`,
      bannerPhotoURL: 'google.com/image_logo.jpg',
      bannerPhotoName: `${PROPERTY_ID}_logo.jpg`,
    };

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon.stub(imageUtil, 'createImage').resolves(Buffer.from([]));
    sinon.stub(imageUtil, 'optimizeImage').resolves(Buffer.from([]));
    sinon.stub(storage, 'propertyUpload').resolves(expected.logoURL);
    sinon.stub(propertiesModel, 'updateRecord').resolves();

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}?target=logo`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = res.body.data || {};
    const actual = result.attributes || {};
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId',
    stubAuth,
    fileParser,
    handler({ collection: () => {} }, { bucket: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
