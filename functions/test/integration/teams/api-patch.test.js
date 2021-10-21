const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const teamsModel = require('../../../models/teams');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../teams/api/patch');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Teams | API | PATCH', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to update team without a payload', async () => {
    const expected = 'name';
    const teamId = uuid();

    const res = await request(createApp())
      .patch(`/t/${teamId}`)
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

  it('rejects request to update team without a providing a name', async () => {
    const expected = 'name';
    const teamId = uuid();

    const res = await request(createApp())
      .patch(`/t/${teamId}`)
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

  it('rejects request to update team with the same name it already has', () => {
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Curent Name' });

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));

    return request(createApp())
      .patch(`/t/${teamId}`)
      .send({ name: team.name.toLowerCase() })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409); // Assertion
  });

  it('rejects request to update team with a name that is already in use', () => {
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Original Name' });
    const existingTeam = mocking.createTeam({ name: 'In Use' });

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon
      .stub(teamsModel, 'query')
      .resolves(firebase.createQuerySnapshot([existingTeam]));

    return request(createApp())
      .patch(`/t/${teamId}`)
      .send({ name: existingTeam.name.toLowerCase() })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409); // Assertion
  });

  it('updates a team and titlizes user provided name', async () => {
    const expected = 'It Is Titlized';
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Original Name' });

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon.stub(teamsModel, 'query').resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(notificationsModel, 'addRecord').resolves();
    const updateReq = sinon.stub(teamsModel, 'updateRecord').resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${teamId}`)
      .send({ name: 'it is TitLized' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = updateReq.called ? updateReq.firstCall : { args: [] };
    const actual = (result.args[2] || {}).name || '';
    expect(actual).to.equal(expected);
  });

  it('sends notification upon successful team update', async () => {
    const expected = true;
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Original Name' });

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon.stub(teamsModel, 'query').resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(teamsModel, 'updateRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${teamId}`)
      .send({ name: 'Update Team' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Original Name' });

    // Stubs
    sinon
      .stub(teamsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(teamId, team));
    sinon.stub(teamsModel, 'query').resolves(firebase.createQuerySnapshot([])); // empty
    sinon.stub(teamsModel, 'updateRecord').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch(`/t/${teamId}?incognitoMode=true`)
      .send({ name: 'Update Team' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:teamId',
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
