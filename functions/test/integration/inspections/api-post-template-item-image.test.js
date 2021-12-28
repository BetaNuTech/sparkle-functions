const request = require('supertest');
const { expect } = require('chai');
const path = require('path');
const express = require('express');
const fileParser = require('express-multipart-file-parser');
const sinon = require('sinon');
const imageUtil = require('../../../utils/images');
const storageService = require('../../../services/storage');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/post-template-item-image');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const SRC_PROFILE_IMG = 'test-image.jpg';
const IMG_PATH = path.join(__dirname, `../../end-to-end/${SRC_PROFILE_IMG}`);
const ITEM_ID = uuid();
const INSPECTION_ID = uuid();

describe('Inspections | API | POST Template Item Image', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request missing file payload', async () => {
    const expected = 'missing "file"';

    // Execute
    const res = await request(createApp())
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
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
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
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

  it('rejects request to add photo to non-existent inspection', async () => {
    const expected = 'Inspection not found';

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to add photo to non-existent inspection item', async () => {
    const expected = 'Inspection item not found';
    const inspection = mocking.createInspection({ property: uuid() });
    delete inspection.template;

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(INSPECTION_ID, inspection));

    const res = await request(createApp())
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
      .attach('file', IMG_PATH)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('successfully updates an inspection item image', async () => {
    const expected = {
      downloadURL: 'google.com/image.jpg',
    };
    const sectionId = uuid();
    const item = mocking.createCompletedMainInputItem(
      'twoactions_checkmarkx',
      false,
      { sectionId }
    );
    const template = mocking.createTemplate({
      name: 'test',
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [ITEM_ID]: item,
      },
    });
    const inspection = mocking.createInspection({
      template,
      property: uuid(),
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(INSPECTION_ID, inspection));
    sinon.stub(imageUtil, 'createImage').resolves(Buffer.from([]));
    sinon.stub(imageUtil, 'optimizeImage').resolves(Buffer.from([]));
    sinon
      .stub(storageService, 'findAllInspectionItemPhotoFileNames')
      .rejects(Error('oops')); // should ignore failure
    sinon
      .stub(storageService, 'inspectionItemUpload')
      .resolves(expected.downloadURL);

    // Execute
    const res = await request(createApp())
      .post(`/t/${INSPECTION_ID}/${ITEM_ID}`)
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
    '/t/:inspectionId/:itemId',
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
