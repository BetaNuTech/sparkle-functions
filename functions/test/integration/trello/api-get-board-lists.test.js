const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const trelloService = require('../../../services/trello');
const handler = require('../../../trello/api/get-board-lists');

describe('Trello | API | GET Board Lists', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when user has no trello lists within board', done => {
    const expected = 'has no lists';

    sinon.stub(trelloService, 'fetchBoardLists').resolves([]);

    request(createApp())
      .get(`/t/123`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns all fetched trello boards', done => {
    const expected = {
      id: '456',
      type: 'trello-list',
      attributes: { name: 'test-list' },
      relationships: {
        board: { type: 'trello-board', id: '123' },
      },
    };

    sinon
      .stub(trelloService, 'fetchBoardLists')
      .resolves([{ id: expected.id, name: expected.attributes.name }]);

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const [actual] = res.body.data;
        expect(actual).to.deep.contain(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get(
    '/t/:boardId',
    stubAuth,
    stubTrelloReq,
    handler({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  return app;
}

function stubTrelloReq(req, res, next) {
  req.trelloCredentials = {
    authToken: 'token',
    apikey: 'key',
  };
  next();
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
