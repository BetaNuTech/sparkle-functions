const assert = require('assert');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const usersModel = require('../../../models/users');
const notificationsModel = require('../../../models/notifications');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../users/api/patch');

describe('Users | API | PATCH', () => {
  afterEach(() => sinon.restore());

  it('rejects request to update unsupported user attributes', async () => {
    const app = createApp();

    const requests = [
      { body: {} },
      { body: { superAdmin: 'string' } },
      { body: { admin: 'string' } },
      { body: { whatever: true } },
    ];

    for (let i = 0; i < requests.length; i++) {
      const { body } = requests[i];

      await request(app)
        .patch('/t/1?incognitoMode=true')
        .send(body)
        .expect('Content-Type', /json/)
        .expect(400)
        .then(res => {
          expect(res.body.errors[0].detail).to.contain('invalid');
        });
    }
  });

  it('rejects request from non super admin to update another super admin', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(false);
    sinon.stub(usersModel, 'upsertCustomClaims').callsFake(() => {
      expect(true).to.equal(false, 'should not be called');
    });

    const res = await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ superAdmin: true })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body.errors[0].detail).to.contain('do not have permission');
  });

  it('rejects request from non admin to update another users permission level', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(false);
    sinon.stub(usersModel, 'upsertCustomClaims').callsFake(() => {
      expect(true).to.equal(false, 'should not be called');
    });

    const res = await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ corporate: true })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body.errors[0].detail).to.contain('do not have permission');
  });

  it('rejects request to create a corporate/admin user', async () => {
    const res = await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ admin: true, corporate: true })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body.errors[0].detail).to.contain('corporate admin');
  });

  it('rejects request to update a non-existent user', async () => {
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves(null);

    const res = await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(404);

    expect(res.body.errors[0].detail).to.contain('does not exist');
  });

  it('allows setting the requested user as a super admin', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap('1', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ superAdmin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(setRecord.called).to.equal(false, 'does not update user record');
    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows setting the requested user as an admin', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap('2', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(setRecord.called).to.equal(true, 'updated user record');
    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows setting the requested user as a corporate', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap('3', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ corporate: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(setRecord.called).to.equal(true, 'updated user record');
    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows admins to disable a user', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap('3', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ isDisabled: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(false, 'did not update custom claim');
    expect(setDisabled.called).to.equal(true, 'updated user auth disabled');
    expect(setRecord.called).to.equal(true, 'updated user record');
  });

  it('allows removing a team from a user', async () => {
    const userId = uuid();
    const teamId = uuid();
    const user = mocking.createUser({
      email: 'test',
      teams: { [teamId]: true },
    });
    const expected = null;

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap(userId, user));
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ teams: { [teamId]: false } })
      .expect('Content-Type', /json/)
      .expect(200);

    const result = setRecord.firstCall || { args: [] };
    const actual = ((result.args[2] || {}).teams || {})[teamId];
    expect(actual).to.equal(expected);
  });

  it('allows adding a team to a user', async () => {
    const teamId = uuid();
    const userId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const user = mocking.createUser();
    const expected = {
      [teamId]: {
        [property1Id]: true,
        [property2Id]: true,
      },
    };

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap(userId, user));
    const getPropertyTeams = sinon
      .stub(propertiesModel, 'findAllTeamRelationships')
      .resolves({
        docs: [
          createFirestoreSnap(property1Id, { team: teamId }),
          createFirestoreSnap(property2Id, { team: teamId }),
        ],
      });
    const setRecord = sinon
      .stub(usersModel, 'setRecord')
      .callsFake((_, id, update) => {
        expect(update.teams).to.deep.equal(
          expected,
          'added team with nested properties'
        );
        return Promise.resolve();
      });

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ teams: { [teamId]: true } })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(getPropertyTeams.called).to.equal(true, 'queried property teams');
    expect(setRecord.called).to.equal(true, 'updated user record');
  });

  it('allows adding and removing a team from a user', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const userId = uuid();
    const user = mocking.createUser({ teams: { [team1Id]: true } });
    const expected = {
      [team1Id]: null,
      [team2Id]: true,
    };

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createFirestoreSnap(userId, user));
    sinon
      .stub(propertiesModel, 'findAllTeamRelationships')
      .resolves({ docs: [] });
    const setRecord = sinon.stub(usersModel, 'setRecord').resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ teams: { [team1Id]: false, [team2Id]: true } })
      .expect('Content-Type', /json/)
      .expect(200);

    const result = setRecord.firstCall || { args: [] };
    const actual = (result.args[2] || {}).teams || {};
    expect(actual).to.deep.equal(expected);
  });

  it('sends the user disabled global notification', async () => {
    const expected = 'User Disabled';
    const user = mocking.createUser();

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .onFirstCall()
      .resolves(createFirestoreSnap('1', { ...user, isDisabled: false }))
      .onSecondCall()
      .resolves(createFirestoreSnap('1', { ...user, isDisabled: true }));
    sinon.stub(usersModel, 'setAuthUserDisabled').resolves({});
    sinon.stub(usersModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ isDisabled: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(addNotification.calledOnce).to.equal(
      true,
      'only created one notification'
    );
    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || {}).title || '';
    expect(actual).to.equal(expected, 'created expected notification');
  });

  it('does not send the user disabled global notification in incognito mode', async () => {
    const expected = false;
    const user = mocking.createUser();

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .onFirstCall()
      .resolves(createFirestoreSnap('1', { ...user, isDisabled: false }))
      .onSecondCall()
      .resolves(createFirestoreSnap('1', { ...user, isDisabled: true }));
    sinon.stub(usersModel, 'setAuthUserDisabled').resolves({});
    sinon.stub(usersModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ isDisabled: true })
      .expect('Content-Type', /json/)
      .expect(200);

    const actual = addNotification.calledOnce;
    expect(actual).to.equal(expected);
  });

  it('sends the user updated global notification', async () => {
    const expected = 'User Update';
    const user = mocking.createUser({ admin: false });

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .onFirstCall()
      .resolves(createFirestoreSnap('1', { ...user }))
      .onSecondCall()
      .resolves(createFirestoreSnap('1', { ...user, admin: true }));
    sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    sinon.stub(usersModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(addNotification.calledOnce).to.equal(
      true,
      'only created one notification'
    );
    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || {}).title || '';
    expect(actual).to.equal(expected, 'created expected notification');
  });

  it('does not send the user updated global notification in incognito mode', async () => {
    const expected = false;
    const user = mocking.createUser({ admin: false });

    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'findRecord')
      .onFirstCall()
      .resolves(createFirestoreSnap('1', { ...user }))
      .onSecondCall()
      .resolves(createFirestoreSnap('1', { ...user, admin: true }));
    sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    sinon.stub(usersModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1?incognitoMode=true')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    const actual = addNotification.calledOnce;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:userId',
    bodyParser.json(),
    stubAuth,
    handler(
      {
        collection: () => {},
        runTransaction: fn => Promise.resolve(fn()),
      },
      {
        getUser: () => {},
      }
    )
  );
  return app;
}

function createFirestoreSnap(id, data = {}) {
  assert(id && typeof id === 'string', 'has record id');
  return {
    id,
    exists: Boolean(data),
    data: () => data || undefined,
  };
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
