const nock = require('nock');
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../trello/api/post-auth');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const GET_TRELLO_TOKEN_PAYLOAD = require('../../../test-helpers/mocks/get-trello-token.json');
const GET_TRELLO_MEMBER_PAYLOAD = require('../../../test-helpers/mocks/get-trello-member.json');
const { fs } = require('../../setup');

describe('Trello | API | POST Auth', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(null, fs);
  });

  it('successfully creates new Trello integration documents', async () => {
    const result = {
      authToken: 'xoxp-auth-token',
      apikey: 'key',
      member: uuid(),
      trelloUsername: 'user',
      trelloEmail: 'email',
      trelloFullName: 'test user',
    };

    // Stub API
    nock('https://api.trello.com')
      .get(`/1/tokens/${result.authToken}?key=${result.apikey}`)
      .reply(200, {
        ...GET_TRELLO_TOKEN_PAYLOAD,
        ...{ idMember: result.member },
      });
    nock('https://api.trello.com')
      .get(
        `/1/members/${result.member}?key=${result.apikey}&token=${result.authToken}`
      )
      .reply(200, {
        ...GET_TRELLO_MEMBER_PAYLOAD,
        ...{
          member: result.member,
          username: result.trelloUsername,
          email: result.trelloEmail,
          fullName: result.trelloFullName,
        },
      });

    // Execute
    const app = createApp();
    await request(app)
      .post('/t')
      .send({ apikey: result.apikey, authToken: result.authToken })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const systemDoc = await systemModel.firestoreFindTrello(fs);
    const integrationDoc = await integrationsModel.firestoreFindTrello(fs);

    // Assertions
    [
      {
        actual: (systemDoc.data() || {}).authToken || '',
        expected: result.authToken,
        msg: 'stored auth token in system collection',
      },
      {
        actual: (systemDoc.data() || {}).apikey || '',
        expected: result.apikey,
        msg: 'stored trello api key in system collection',
      },
      {
        actual: (integrationDoc.data() || {}).member,
        expected: result.member,
        msg: 'stored Trello member id in integration collection',
      },
      {
        actual: (integrationDoc.data() || {}).trelloUsername,
        expected: result.trelloUsername,
        msg: 'stored Trello user name in integration collection',
      },
      {
        actual: (integrationDoc.data() || {}).trelloEmail,
        expected: result.trelloEmail,
        msg: 'stored Trello email in integration collection',
      },
      {
        actual: (integrationDoc.data() || {}).trelloFullName,
        expected: result.trelloFullName,
        msg: 'stored Trello user full name in integration collection',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), stubAuth, handler(fs));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
