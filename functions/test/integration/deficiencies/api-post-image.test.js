const request = require('supertest');
const { expect } = require('chai');
const path = require('path');
const express = require('express');
const fileParser = require('express-multipart-file-parser');
const sinon = require('sinon');
const imageUtil = require('../../../utils/images');
const storageService = require('../../../services/storage');
const deficiencyModel = require('../../../models/deficient-items');
const handler = require('../../../deficient-items/api/post-image');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const SRC_PROFILE_IMG = 'test-image.jpg';
const IMG_PATH = path.join(__dirname, `../../end-to-end/${SRC_PROFILE_IMG}`);
const DEF_ITEM_ID = uuid();

describe('Deficient Items | API | POST Image', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request missing file payload', async () => {
    const expected = 'missing "file"';

    // Execute
    const res = await request(createApp())
      .post(`/t/${DEF_ITEM_ID}`)
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

  it('rejects request with unsupported image type', async () => {
    const expected = 'mime';

    // Stubs
    sinon.stub(imageUtil, 'getMimeType').returns('');

    // Execute
    const res = await request(createApp())
      .post(`/t/${DEF_ITEM_ID}`)
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

  it('rejects request to add photo to non-existent deficient item', async () => {
    const expected = 'Deficient item not found';

    // Stub Requests
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${DEF_ITEM_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('successfully updates an deficient item image', async () => {
    const expected = {
      downloadURL: 'google.com/image.jpg',
    };
    const deficiency = mocking.createDeficiency({
      inspection: uuid(),
      property: uuid(),
      item: uuid(),
    });

    // Stubs
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(DEF_ITEM_ID, deficiency));
    sinon.stub(imageUtil, 'createImage').resolves(Buffer.from([]));
    sinon.stub(imageUtil, 'optimizeImage').resolves(Buffer.from([]));
    sinon
      .stub(storageService, 'deficientItemUpload')
      .resolves(expected.downloadURL);

    // Execute
    const res = await request(createApp())
      .post(`/t/${DEF_ITEM_ID}`)
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
    '/t/:deficiencyId',
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
