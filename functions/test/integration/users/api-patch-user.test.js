const assert = require('assert');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const usersModel = require('../../../models/users');
const propertiesModel = require('../../../models/properties');
const createPatchUser = require('../../../users/api/patch-user');

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
        .patch('/t/1')
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
      .patch('/t/1')
      .send({ superAdmin: true })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body.errors[0].detail).to.contain('do not have permission');
  });

  it('rejects request from non admin to update another admin', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(false);
    sinon.stub(usersModel, 'upsertCustomClaims').callsFake(() => {
      expect(true).to.equal(false, 'should not be called');
    });

    const res = await request(createApp())
      .patch('/t/1')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body.errors[0].detail).to.contain('do not have permission');
  });

  it('rejects request to create a corporate/admin user', async () => {
    const res = await request(createApp())
      .patch('/t/1')
      .send({ admin: true, corporate: true })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body.errors[0].detail).to.contain('corporate admin');
  });

  it('rejects request to update a non-existent user', async () => {
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves(null);

    const res = await request(createApp())
      .patch('/t/1')
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
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('1', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ superAdmin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(userUpdate.called).to.equal(false, 'does not update user record');
    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows setting the requested user as an admin', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('2', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ admin: true })
      .expect('Content-Type', /json/)
      .expect(200);

    const userDbUpdates = (userUpdate.args || [[]])[0][2] || {};
    const actualPropertiesUpdate = userDbUpdates.properties || null;
    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(userUpdate.called).to.equal(true, 'updated user record');
    if (userUpdate.called) {
      expect(actualPropertiesUpdate).to.deep.equal(
        {},
        'removed admin user properties'
      );
    }

    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows setting the requested user as a corporate', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('3', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ corporate: true })
      .expect('Content-Type', /json/)
      .expect(200);

    const userDbUpdates = (userUpdate.args || [[]])[0][2] || {};
    const actualPropertiesUpdate = userDbUpdates.properties || null;
    expect(setClaims.called).to.equal(true, 'updated custom claim');
    expect(userUpdate.called).to.equal(true, 'updated user record');
    if (userUpdate.called) {
      expect(actualPropertiesUpdate).to.deep.equal(
        {},
        'removed corporate user properties'
      );
    }
    expect(setDisabled.called).to.equal(false, 'did not update auth disabled');
  });

  it('allows admins to disable a user', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('3', { email: 'test' }));
    const setClaims = sinon.stub(usersModel, 'upsertCustomClaims').resolves();
    const setDisabled = sinon
      .stub(usersModel, 'setAuthUserDisabled')
      .resolves({});
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .resolves();

    await request(createApp())
      .patch('/t/1')
      .send({ isDisabled: true })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(setClaims.called).to.equal(false, 'did not update custom claim');
    expect(setDisabled.called).to.equal(true, 'updated user auth disabled');
    expect(userUpdate.called).to.equal(true, 'updated user record');
  });

  it('allows removing all users teams', async () => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasUpdatePermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUser').resolves({});
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('3', { email: 'test' }));
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .callsFake((_, id, update) => {
        expect(update.teams).to.deep.equal({}, 'removing users teams');
        return Promise.resolve();
      });

    await request(createApp())
      .patch('/t/1')
      .send({ teams: null })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(userUpdate.called).to.equal(true, 'updated user record');
  });

  it('allows setting users teams', async () => {
    const teamId = '1';
    const property1Id = '2';
    const property2Id = '3';
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
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createFirestoreSnap('4', { email: 'test' }));
    const getPropertyTeams = sinon
      .stub(propertiesModel, 'findAllTeamRelationships')
      .resolves({
        docs: [
          createFirestoreSnap(property1Id, { team: teamId }),
          createFirestoreSnap(property2Id, { team: teamId }),
        ],
      });
    const userUpdate = sinon
      .stub(usersModel, 'firestoreUpsertRecord')
      .callsFake((_, id, update) => {
        expect(update.teams).to.deep.equal(
          expected,
          'added team with nested properties'
        );
        return Promise.resolve();
      });

    await request(createApp())
      .patch('/t/1')
      .send({ teams: { [teamId]: true } })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(getPropertyTeams.called).to.equal(true, 'queried property teams');
    expect(userUpdate.called).to.equal(true, 'updated user record');
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:userId',
    bodyParser.json(),
    stubAuth,
    createPatchUser(
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
