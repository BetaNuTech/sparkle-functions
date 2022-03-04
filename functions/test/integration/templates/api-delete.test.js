const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const sinon = require('sinon');
const templatesModel = require('../../../models/templates');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../templates/api/delete');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Templates | API | DELETE', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to delete template that cannot be found', () => {
    const templateId = uuid();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .delete(`/t/${templateId}`)
      .send()
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect(404); // Assertion
  });

  it('sends notification upon successful template delete', async () => {
    const expected = true;
    const templateId = uuid();
    const template = mocking.createTemplate();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(propertiesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templatesModel, 'removeRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .delete(`/t/${templateId}`)
      .send()
      .expect(204);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const templateId = uuid();
    const template = mocking.createTemplate();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(propertiesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(templatesModel, 'removeRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .delete(`/t/${templateId}?incognitoMode=true`)
      .send()
      .expect(204);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t/:templateId',
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
