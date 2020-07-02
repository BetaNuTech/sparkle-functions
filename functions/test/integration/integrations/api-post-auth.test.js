const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const slackService = require('../../../services/slack');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const postSlackAuth = require('../../../slack/api/post-auth');

describe('Integrations | API | POST Slack Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when a slack code is not provided', done => {
    const expected = 'slackCode';

    request(createApp())
      .post('/t')
      .send()
      .expect('Content-Type', /json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when a redirect URI is not provided', done => {
    const expected = 'redirectUri';

    request(createApp())
      .post('/t')
      .send({ slackCode: 'test' })
      .expect('Content-Type', /json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('stores access token from successful slack authorization', done => {
    const expected = 'test-token';
    sinon.stub(slackService, 'authorizeCredentials').resolves({
      access_token: expected,
      team_name: 'team',
      team_id: '123',
      scope: 'test',
    });

    let actual = '';
    sinon
      .stub(systemModel, 'firestoreUpsertSlackAppCredentials')
      .callsFake((_, { token }) => {
        actual = token;
        return Promise.reject(Error('fail'));
      });

    request(createApp())
      .post('/t')
      .send({ slackCode: 'test', redirectUri: '/test' })
      .expect('Content-Type', /json/)
      .expect(500)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('stores Slack team from successful slack authorization', done => {
    const expected = '4825';
    sinon.stub(slackService, 'authorizeCredentials').resolves({
      access_token: 'token',
      team_name: 'team',
      team_id: expected,
      scope: 'test',
    });
    sinon.stub(systemModel, 'firestoreUpsertSlackAppCredentials').resolves();

    let actual = '';
    sinon
      .stub(integrationsModel, 'firestoreSetSlack')
      .callsFake((_, { team }) => {
        actual = team;
        return Promise.reject(Error('fail'));
      });

    request(createApp())
      .post('/t')
      .send({ slackCode: 'test', redirectUri: '/test' })
      .expect('Content-Type', /json/)
      .expect(500)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns public Slack integration data as successful response', done => {
    const integrationData = {
      createdAt: Math.round(Date.now() / 1000),
      grantedBy: '123',
      team: '8000',
      teamName: 'test',
    };
    const expected = {
      data: {
        id: 'slack',
        type: 'integration',
        attributes: JSON.parse(JSON.stringify(integrationData)),
      },
    };
    sinon.stub(slackService, 'authorizeCredentials').resolves({});
    sinon.stub(systemModel, 'firestoreUpsertSlackAppCredentials').resolves();
    sinon
      .stub(integrationsModel, 'firestoreSetSlack')
      .resolves(integrationData);

    request(createApp())
      .post('/t')
      .send({ slackCode: 'test', redirectUri: '/test' })
      .expect('Content-Type', /json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
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
    postSlackAuth({
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
