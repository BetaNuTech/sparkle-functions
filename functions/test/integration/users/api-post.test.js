const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const usersModel = require('../../../models/users');
const handler = require('../../../users/api/post');

describe('Users | API | POST', () => {
  afterEach(() => sinon.restore());

  it('rejects request with invalid firstName or lastName', async () => {
    const app = createApp();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);

    const requests = [
      { body: {} },
      { body: { firstName: 2 } },
      { body: { firstName: '' } },
      { body: { firstName: 'a' } },
      { body: { firstName: 'a', lastName: 2 } },
      { body: { firstName: 'a', lastName: '' } },
    ];

    for (let i = 0; i < requests.length; i++) {
      const { body } = requests[i];

      await request(app)
        .post('/t')
        .send(body)
        .expect('Content-Type', /json/)
        .expect(400)
        .then(res => {
          const err = res.body.errors[0];
          const pointerMatch =
            body.firstName && typeof body.firstName === 'string'
              ? 'lastName'
              : 'firstName';
          expect(err.source.pointer).to.contain(pointerMatch);
          expect(err.detail).to.contain('invalid');
        });
    }
  });

  it('rejects request with invalid email', async () => {
    const app = createApp();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);

    const requests = [
      { body: { firstName: 'a', lastName: 'b' } },
      { body: { firstName: 'a', lastName: 'b', email: 2 } },
      { body: { firstName: 'a', lastName: 'b', email: '' } },
      { body: { firstName: 'a', lastName: 'b', email: 'g@gmail@gmail.com' } },
      { body: { firstName: 'a', lastName: 'b', email: 'g@.com' } },
      { body: { firstName: 'a', lastName: 'b', email: 'google.com' } },
    ];

    for (let i = 0; i < requests.length; i++) {
      const { body } = requests[i];

      await request(app)
        .post('/t')
        .send(body)
        .expect('Content-Type', /json/)
        .expect(400)
        .then(res => {
          const err = res.body.errors[0];
          expect(err.source.pointer).to.contain('email');
          expect(err.detail).to.contain('invalid');
        });
    }
  });

  it('rejects request to create a user that already exists', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUserByEmail').resolves({ uid: '-1' });
    sinon.stub(usersModel, 'findRecord').resolves({ data: () => ({}) }); // truethy user record

    request(createApp())
      .post('/t')
      .send({ firstName: 'a', lastName: 'b', email: 't@g.com' })
      .expect('Content-Type', /json/)
      .expect(403)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('already exists');
        done();
      })
      .catch(done);
  });

  it('creates an auth user when auth user does not already exist', done => {
    // Stup auth requests
    const notFoundErr = new Error('not found');
    const emptySnap = createEmptySnapshot();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUserByEmail').rejects(notFoundErr);
    sinon.stub(usersModel, 'findRecord').resolves(emptySnap);
    sinon.stub(usersModel, 'upsertRecord').resolves();
    const createUser = sinon
      .stub(usersModel, 'createAuthUser')
      .resolves({ uid: '-1' });

    request(createApp())
      .post('/t')
      .send({ firstName: 'a', lastName: 'b', email: 't@g.com' })
      .expect('Content-Type', /json/)
      .expect(201)
      .then(() => {
        expect(createUser.called).to.equal(true);
        done();
      })
      .catch(done);
  });

  it('does not create an auth user when auth user already exist', done => {
    // Stup auth requests
    const emptySnap = createEmptySnapshot();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUserByEmail').resolves({ uid: '-1' });
    sinon.stub(usersModel, 'findRecord').resolves(emptySnap);
    sinon.stub(usersModel, 'upsertRecord').resolves();
    const createUser = sinon
      .stub(usersModel, 'createAuthUser')
      .resolves({ uid: '-1' });

    request(createApp())
      .post('/t')
      .send({ firstName: 'a', lastName: 'b', email: 't@g.com' })
      .expect('Content-Type', /json/)
      .expect(201)
      .then(() => {
        expect(createUser.called).to.equal(false);
        done();
      })
      .catch(done);
  });

  it('creates a new user record', done => {
    // Stup auth requests
    const uid = '-2';
    const expected = {
      firstName: 'a',
      lastName: 'b',
      email: 't@g.com',
      admin: false,
      corporate: false,
      isDisabled: false,
      pushOptOut: false,
    };
    const emptySnap = createEmptySnapshot();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUserByEmail').resolves({ uid });
    sinon.stub(usersModel, 'findRecord').resolves(emptySnap);
    const createUser = sinon
      .stub(usersModel, 'upsertRecord')
      .callsFake((_, actualUid, actual) => {
        expect(actualUid).to.equal(uid, 'has expected UID');
        expect(actual.createdAt).to.be.a('number', 'has a createdAt timestamp');
        delete actual.createdAt;
        expect(actual).to.deep.equal(expected, 'has expected user JSON');
      });

    request(createApp())
      .post('/t')
      .send(expected)
      .expect('Content-Type', /json/)
      .expect(201)
      .then(() => {
        expect(createUser.called).to.equal(true);
        done();
      })
      .catch(done);
  });

  it('returns a JSON-API formatted user', done => {
    // Stup auth requests
    const uid = '-2';
    const expected = {
      data: {
        type: 'user',
        id: uid,
        attributes: {
          firstName: 'a',
          lastName: 'b',
          email: 't@g.com',
          admin: false,
          corporate: false,
          isDisabled: false,
          pushOptOut: false,
        },
      },
    };
    const emptySnap = createEmptySnapshot();
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);
    sinon.stub(usersModel, 'getAuthUserByEmail').resolves({ uid });
    sinon.stub(usersModel, 'findRecord').resolves(emptySnap);
    sinon.stub(usersModel, 'upsertRecord').resolves();

    request(createApp())
      .post('/t')
      .send(expected.data.attributes)
      .expect('Content-Type', /json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
        expect(actual.data.attributes.createdAt).to.be.a(
          'number',
          'has a created at timestamp'
        );
        delete actual.data.attributes.createdAt;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t',
    bodyParser.json(),
    stubAuth,
    handler({ collection: () => {} }, {})
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function createEmptySnapshot() {
  return { exists: false, data: () => undefined };
}
