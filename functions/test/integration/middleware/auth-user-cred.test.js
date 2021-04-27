const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const usersModel = require('../../../models/users');
const authUserCrud = require('../../../middleware/auth-user-crud');

describe('Middleware | Auth User CRUD', () => {
  afterEach(() => sinon.restore());

  it('rejects request from non admin to post users', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({});

    request(createApp())
      .post('/t')
      .send()
      .expect(401)
      .then(res => {
        const [err] = res.body.errors;
        expect(err.detail).to.contain('do not have permission to create');
        done();
      })
      .catch(done);
  });

  it('rejects request from non admin to get users', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({});

    request(createApp())
      .get('/t/123')
      .send()
      .expect(401)
      .then(res => {
        const [err] = res.body.errors;
        expect(err.detail).to.contain('do not have permission to read');
        done();
      })
      .catch(done);
  });

  it('rejects request from non admin to delete users', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({});

    request(createApp())
      .delete('/t/123')
      .send()
      .expect(401)
      .then(res => {
        const [err] = res.body.errors;
        expect(err.detail).to.contain('do not have permission to delete');
        done();
      })
      .catch(done);
  });

  it('rejects request from non admin to update users via PATCH', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({});

    request(createApp())
      .patch('/t/123')
      .send({})
      .expect(401)
      .then(res => {
        const [err] = res.body.errors;
        expect(err.detail).to.contain('do not have permission to update');
        done();
      })
      .catch(done);
  });

  it('rejects request from non admin to update users via PUT', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({});

    request(createApp())
      .put('/t/123')
      .send({})
      .expect(401)
      .then(res => {
        const [err] = res.body.errors;
        expect(err.detail).to.contain('do not have permission to update');
        done();
      })
      .catch(done);
  });

  it('allows requests from admins', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'hasCrudPermission').resolves(true);

    request(createApp())
      .post('/t')
      .send({})
      .expect(200)
      .then(() => done())
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.post('/t', stubAuth, authUserCrud({ getUser: () => {} }), sendSuccess);
  app.get(
    '/t/:userId',
    stubAuth,
    authUserCrud({ getUser: () => {} }),
    sendSuccess
  );
  app.delete(
    '/t/:userId',
    stubAuth,
    authUserCrud({ getUser: () => {} }),
    sendSuccess
  );
  app.patch(
    '/t/:userId',
    stubAuth,
    authUserCrud({ getUser: () => {} }),
    sendSuccess
  );
  app.put(
    '/t/:userId',
    stubAuth,
    authUserCrud({ getUser: () => {} }),
    sendSuccess
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function sendSuccess(_, res) {
  res.status(200).send('success');
}
