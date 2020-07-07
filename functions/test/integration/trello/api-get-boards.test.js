const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const trelloService = require('../../../services/trello');
const handler = require('../../../trello/api/get-boards');

describe('Trello | API | GET Boards', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when user has no trello boards', done => {
    const expected = 'no trello boards';

    sinon.stub(trelloService, 'fetchAllBoards').resolves([]);

    request(createApp())
      .get('/t')
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
      id: '123',
      type: 'trello-board',
      attributes: { name: 'test-board' },
      relationships: {},
    };

    sinon
      .stub(trelloService, 'fetchAllBoards')
      .resolves([{ id: expected.id, name: expected.attributes.name }]);
    sinon.stub(trelloService, 'fetchAllOrganizations').resolves([]);

    request(createApp())
      .get('/t')
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

  it('includes and associates all organizations with their boards', done => {
    const expected = {
      data: [
        {
          id: '123',
          type: 'trello-board',
          attributes: { name: 'test-board' },
          relationships: {
            trelloOrganization: {
              data: { id: '456', type: 'trello-organization' },
            },
          },
        },
      ],
      included: [
        {
          id: '456',
          type: 'trello-organization',
          attributes: { name: 'test-org' },
        },
      ],
    };
    sinon.stub(trelloService, 'fetchAllBoards').resolves([
      {
        id: '123',
        name: 'test-board',
      },
    ]);
    sinon.stub(trelloService, 'fetchAllOrganizations').resolves([
      {
        id: '456',
        displayName: 'test-org',
        idBoards: ['123'],
      },
    ]);

    request(createApp())
      .get('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.contain(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get(
    '/t',
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
