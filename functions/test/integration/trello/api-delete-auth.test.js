const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const deleteAuth = require('../../../trello/api/delete-auth');

describe('Trello | API | DELETE Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns JSON-API formatted error message when system credentials failed to delete', done => {
    const expected = 'System Error';

    sinon.stub(systemModel, 'firestoreRemoveTrello').rejects(Error('failed'));

    request(createApp())
      .delete('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns JSON-API formatted error message when integration details failed to delete', done => {
    const expected = 'Integration Error';

    sinon.stub(systemModel, 'firestoreRemoveTrello').resolves();
    sinon
      .stub(integrationsModel, 'firestoreRemoveAllTrelloProperties')
      .rejects(Error('failed'));

    request(createApp())
      .delete('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns empty success response when Trello auth successfully deleted', done => {
    sinon.stub(systemModel, 'firestoreRemoveTrello').resolves();
    sinon
      .stub(integrationsModel, 'firestoreRemoveAllTrelloProperties')
      .resolves();

    request(createApp())
      .delete('/t')
      .send()
      .expect(204)
      .then(() => done())
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t',
    stubAuth,
    deleteAuth({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
