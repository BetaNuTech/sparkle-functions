const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const usersModel = require('../../../models/users');
const createDeleteUser = require('../../../users/api/delete-user');

describe('Users | API | DELETE', () => {
  afterEach(() => sinon.restore());

  it('rejects when attempting to delete a non-existent user', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getAuthUser').resolves(null);
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createEmptySnapshot());

    request(createApp())
      .delete('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(404)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('no user found');
        done();
      })
      .catch(done);
  });

  it('deletes the target users firebase auth user', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getAuthUser').resolves({ email: 't@g.com' });
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createUserSnapshot());
    sinon.stub(usersModel, 'deleteRecord').resolves();
    const deleteAuthUser = sinon.stub(usersModel, 'deleteAuthUser').resolves();

    request(createApp())
      .delete('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(() => {
        expect(deleteAuthUser.called).to.equal(true);
        done();
      })
      .catch(done);
  });

  it('deletes the target users document', done => {
    // Stup auth requests
    sinon.stub(usersModel, 'getAuthUser').resolves(null);
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createUserSnapshot());
    const deleteUser = sinon.stub(usersModel, 'deleteRecord').resolves();

    request(createApp())
      .delete('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(() => {
        expect(deleteUser.called).to.equal(true);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t/:userId',
    stubAuth,
    createDeleteUser({ collection: () => {} }, {})
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

function createUserSnapshot(user = {}) {
  return { data: () => user };
}
