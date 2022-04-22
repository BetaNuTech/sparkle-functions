const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const trelloService = require('../../../services/trello');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const postAuth = require('../../../trello/api/post-auth');
const mocking = require('../../../test-helpers/mocking');

describe('Trello | API | POST Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when an api key is not provided', done => {
    const expected = 'apikey';

    request(createApp())
      .post('/t?incognitoMode=true')
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
      .post('/t?incognitoMode=true')
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
      .post('/t?incognitoMode=true')
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
      .post('/t?incognitoMode=true')
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
    sinon.stub(systemModel, 'upsertTrello').callsFake((_, result) => {
      actual.authToken = result.authToken;
      actual.apikey = result.apikey;
      return Promise.reject(Error('fail'));
    });

    request(createApp())
      .post('/t?incognitoMode=true')
      .send(expected)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('stores public integration details from successful trello member request', async () => {
    const expected = mocking.createTrelloIntegration();

    // Stubs
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
    sinon.stub(systemModel, 'upsertTrello').resolves();
    sinon.stub(integrationsModel, 'upsertTrello').callsFake((_, result) => {
      actual.member = result.member;
      actual.trelloUsername = result.trelloUsername;
      actual.trelloEmail = result.trelloEmail;
      actual.trelloFullName = result.trelloFullName;
      return Promise.reject(Error('fail'));
    });

    await request(createApp())
      .post('/t?incognitoMode=true')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500);

    delete expected.createdAt;
    expect(actual).to.deep.equal(expected);
  });

  it('returns public Trello integration data as successful response', done => {
    const integrationData = mocking.createTrelloIntegration();
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

    sinon.stub(systemModel, 'upsertTrello').resolves();
    sinon.stub(integrationsModel, 'upsertTrello').resolves(integrationData);

    request(createApp())
      .post('/t?incognitoMode=true')
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

  it('sends notification upon success', async () => {
    const expected = 'Trello Integration Added';
    const integrationData = mocking.createTrelloIntegration();

    // Stubs
    sinon
      .stub(trelloService, 'fetchToken')
      .resolves({ idMember: integrationData.member });
    sinon.stub(trelloService, 'fetchMemberRecord').resolves({
      username: integrationData.trelloUsername,
      email: integrationData.trelloEmail,
      fullName: integrationData.trelloFullName,
    });
    sinon.stub(systemModel, 'upsertTrello').resolves();
    sinon.stub(integrationsModel, 'upsertTrello').resolves(integrationData);
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post('/t')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || {}).title || '';
    expect(actual).to.equal(expected);
  });

  it('does not send notification upon success in incognito mode', async () => {
    const expected = false;
    const integrationData = mocking.createTrelloIntegration();

    // Stubs
    sinon
      .stub(trelloService, 'fetchToken')
      .resolves({ idMember: integrationData.member });
    sinon.stub(trelloService, 'fetchMemberRecord').resolves({
      username: integrationData.trelloUsername,
      email: integrationData.trelloEmail,
      fullName: integrationData.trelloFullName,
    });
    sinon.stub(systemModel, 'upsertTrello').resolves();
    sinon.stub(integrationsModel, 'upsertTrello').resolves(integrationData);
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post('/t?incognitoMode=true')
      .send({ apikey: 'key', authToken: 'token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = addNotification.calledOnce;
    expect(actual).to.equal(expected);
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
