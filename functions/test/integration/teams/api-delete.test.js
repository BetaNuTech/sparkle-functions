const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const teamsModel = require('../../../models/teams');
const usersModel = require('../../../models/users');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../teams/api/delete');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Teams | API | DELETE', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to delete team that cannot be found', () => {
    const teamId = uuid();

    // Stubs
    sinon.stub(teamsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .delete(`/t/${teamId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404); // Assertion
  });

  it('sends notification upon successful team delete', async () => {
    const expected = true;
    const teamId = uuid();
    const team = mocking.createTeam();

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon
      .stub(propertiesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon
      .stub(usersModel, 'findByTeam')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(teamsModel, 'removeRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .delete(`/t/${teamId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const teamId = uuid();
    const team = mocking.createTeam();

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon
      .stub(propertiesModel, 'query')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon
      .stub(usersModel, 'findByTeam')
      .resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(teamsModel, 'removeRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .delete(`/t/${teamId}?incognitoMode=true`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t/:teamId',
    bodyParser.json(),
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
