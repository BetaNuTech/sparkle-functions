const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const trelloService = require('../../../services/trello');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const postAuth = require('../../../trello/api/post-auth');

describe('Trello | API | POST Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when an api key is not provided', done => {
    const expected = 'apikey';

    request(createApp())
      .post('/t')
      .send({ authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when an auth token is not provided', done => {
    const expected = 'authToken';

    request(createApp())
      .post('/t')
      .send({ apikey: 'key' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('rejects an unaccepted trello API token request with unauthorized error', done => {
    sinon.stub(trelloService, 'fetchToken').rejects(Error('no member id'));

    request(createApp())
      .post('/t')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(401)
      .then(() => done())
      .catch(done);
  });

  it('rejects an unaccepted trello API member request with unauthorized error', done => {
    sinon.stub(trelloService, 'fetchToken').resolves({ idMember: '123' });
    sinon
      .stub(trelloService, 'fetchMemberRecord')
      .rejects(Error('no username'));

    request(createApp())
      .post('/t')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(401)
      .then(() => done())
      .catch(done);
  });

  it('stores auth token and api key used for successful trello requests', done => {
    const expected = { authToken: 'token', apikey: 'key' };

    sinon.stub(trelloService, 'fetchToken').resolves({ idMember: '123' });
    sinon
      .stub(trelloService, 'fetchMemberRecord')
      .resolves({ username: 'testor' });

    const actual = { authToken: '', apikey: '' };
    sinon.stub(systemModel, 'firestoreUpsertTrello').callsFake((_, result) => {
      actual.authToken = result.authToken;
      actual.apikey = result.apikey;
      return Promise.reject(Error('fail'));
    });

    request(createApp())
      .post('/t')
      .send(expected)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('stores public integration details from successful trello member request', done => {
    const expected = {
      member: '123',
      trelloUsername: 'user',
      trelloEmail: 'email',
      trelloFullName: 'test user',
    };

    sinon
      .stub(trelloService, 'fetchToken')
      .resolves({ idMember: expected.member });
    sinon.stub(trelloService, 'fetchMemberRecord').resolves({
      username: expected.trelloUsername,
      email: expected.trelloEmail,
      fullName: expected.trelloFullName,
    });

    const actual = {
      member: '',
      trelloUsername: '',
      trelloEmail: '',
      trelloFullName: 'user',
    };
    sinon.stub(systemModel, 'firestoreUpsertTrello').resolves();
    sinon
      .stub(integrationsModel, 'firestoreUpsertTrello')
      .callsFake((_, result) => {
        actual.member = result.member;
        actual.trelloUsername = result.trelloUsername;
        actual.trelloEmail = result.trelloEmail;
        actual.trelloFullName = result.trelloFullName;
        return Promise.reject(Error('fail'));
      });

    request(createApp())
      .post('/t')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns public Trello integration data as successful response', done => {
    const integrationData = {
      createdAt: Math.round(Date.now() / 1000),
      member: '123',
      trelloUsername: 'user',
      trelloEmail: 'email',
      trelloFullName: 'test user',
    };
    const expected = {
      data: {
        id: 'trello',
        type: 'integration',
        attributes: JSON.parse(JSON.stringify(integrationData)),
      },
    };
    sinon
      .stub(trelloService, 'fetchToken')
      .resolves({ idMember: integrationData.member });
    sinon.stub(trelloService, 'fetchMemberRecord').resolves({
      username: integrationData.trelloUsername,
      email: integrationData.trelloEmail,
      fullName: integrationData.trelloFullName,
    });

    sinon.stub(systemModel, 'firestoreUpsertTrello').resolves();
    sinon
      .stub(integrationsModel, 'firestoreUpsertTrello')
      .resolves(integrationData);

    request(createApp())
      .post('/t')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
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
    postAuth({
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
