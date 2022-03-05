const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const templateCategoriesModel = require('../../../models/template-categories');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../template-categories/api/post');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Template Categories | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to create template category without a payload', async () => {
    const expected = 'name';
    const res = await request(createApp())
      .post('/t')
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

  it('rejects request to create template category without a providing a name', async () => {
    const expected = 'name';
    const res = await request(createApp())
      .post('/t')
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

  it('rejects request to create template category with a name that is already in use', () => {
    const existingCategory = mocking.createTemplateCategory({ name: 'In Use' });
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([existingCategory]));

    return request(createApp())
      .post('/t')
      .send({ name: existingCategory.name.toLowerCase() })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409); // Assertion
  });

  it('creates a valid temlate category and titlizes user provided name', async () => {
    const expected = 'It Is Titlized';

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'createId').returns(uuid());
    sinon.stub(notificationsModel, 'addRecord').resolves();
    const createReq = sinon
      .stub(templateCategoriesModel, 'createRecord')
      .resolves({});

    // Execute
    await request(createApp())
      .post('/t')
      .send({ name: 'it is Titlized' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = createReq.called ? createReq.firstCall : { args: [] };
    const actual = (result.args[2] || {}).name || '';
    expect(actual).to.equal(expected);
  });

  it('sends notification upon successful template category creation', async () => {
    const expected = true;

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'createId').returns(uuid());
    sinon.stub(templateCategoriesModel, 'createRecord').resolves({});
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .post('/t')
      .send({ name: 'New Template Category' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'createId').returns(uuid());
    sinon.stub(templateCategoriesModel, 'createRecord').resolves({});
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post('/t?incognitoMode=true')
      .send({ name: 'New Template Category' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t',
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
