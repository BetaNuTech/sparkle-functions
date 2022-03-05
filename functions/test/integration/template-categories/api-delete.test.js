const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const sinon = require('sinon');
const templateCategoriesModel = require('../../../models/template-categories');
const templatesModel = require('../../../models/templates');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../template-categories/api/delete');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Template Categories | API | DELETE', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to delete template category that cannot be found', () => {
    const templateCategoryId = uuid();

    // Stubs
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .delete(`/t/${templateCategoryId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404); // Assertion
  });

  it('sends notification upon successful template category delete', async () => {
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
      .stub(templatesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'deleteRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .delete(`/t/${templateCategoryId}`)
      .send()
      .expect(204);

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
      .stub(templatesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templateCategoriesModel, 'deleteRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .delete(`/t/${templateCategoryId}?incognitoMode=true`)
      .send()
      .expect(204);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t/:templateCategoryId',
    stubAuth,
    handler({
      collection: () => {},
      runTransaction(fn) {
        return fn();
      },
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { admin: true, id: '123' };
  next();
}
