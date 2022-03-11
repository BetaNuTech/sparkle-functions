const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const templateCategoriesModel = require('../../../models/template-categories');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../template-categories/api/patch');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Template Categories | API | PATCH', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to update template category without a payload', async () => {
    const expected = 'name';
    const templateCategoryId = uuid();

    const res = await request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.equal(expected);
  });

  it('rejects request to update template category without a providing a name', async () => {
    const expected = 'name';
    const templateCategoryId = uuid();

    const res = await request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send({ name: '' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.equal(expected);
  });

  it('rejects request to update template category that cannot be found', () => {
    const templateCategoryId = uuid();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send({ name: 'set' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404); // Assertion
  });

  it('rejects request to update template category with a name that is already in use', () => {
    const existingCategory = mocking.createTemplateCategory({ name: 'In Use' });
    const templateCategoryId = uuid();
    const templateCategory = mocking.createTemplateCategory();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(templateCategoryId, templateCategory)
      );
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([existingCategory]));

    return request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send({ name: existingCategory.name.toLowerCase() })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409); // Assertion
  });

  it('updates a valid template category and titlizes user provided name', async () => {
    const expected = 'It Is Titlized';
    const templateCategoryId = uuid();
    const templateCategory = mocking.createTemplateCategory();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(templateCategoryId, templateCategory)
      );
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(notificationsModel, 'addRecord').resolves();
    const createReq = sinon
      .stub(templateCategoriesModel, 'updateRecord')
      .resolves({});

    // Execute
    await request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send({ name: 'it is Titlized' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = createReq.called ? createReq.firstCall : { args: [] };
    const actual = (result.args[2] || {}).name || '';
    expect(actual).to.equal(expected);
  });

  it('sends notification upon successful template category update', async () => {
    const expected = true;
    const templateCategoryId = uuid();
    const templateCategory = mocking.createTemplateCategory();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(templateCategoryId, templateCategory)
      );
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'updateRecord').resolves({});
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${templateCategoryId}`)
      .send({ name: 'Updated Template Category' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const templateCategoryId = uuid();
    const templateCategory = mocking.createTemplateCategory();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(templateCategoryId, templateCategory)
      );
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'updateRecord').resolves({});
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch(`/t/${templateCategoryId}?incognitoMode=true`)
      .send({ name: 'Updated Template Category' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:templateCategoryId',
    bodyParser.json(),
    stubAuth,
    handler({ collection: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { admin: true, id: '123' };
  next();
}
