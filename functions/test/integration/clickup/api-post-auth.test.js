const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const clickupService = require('../../../services/clickup');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const postAuth = require('../../../clickup/api/post-auth');
const mocking = require('../../../test-helpers/mocking');

describe('ClickUp | API | POST Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when an API token is not provided', done => {
    const expected = 'apiToken';

    request(createApp())
      .post('/c?incognitoMode=true')
      .send({})
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('rejects an unaccepted ClickUp API token request with unauthorized error', done => {
    sinon.stub(clickupService, 'fetchTeams').rejects(Error('invalid token'));

    request(createApp())
      .post('/c?incognitoMode=true')
      .send({ apiToken: 'invalid_token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(401)
      .then(() => done())
      .catch(done);
  });

  it('rejects when user has no accessible workspaces', done => {
    sinon.stub(clickupService, 'fetchTeams').resolves({ teams: [] });

    request(createApp())
      .post('/c?incognitoMode=true')
      .send({ apiToken: 'valid_token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(401)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('No accessible workspaces');
        done();
      })
      .catch(done);
  });

  it('stores API token used for successful ClickUp requests', done => {
    const expected = { apiToken: 'valid_token' };

    sinon.stub(clickupService, 'fetchTeams').resolves({
      teams: [{ id: '123', name: 'Test Workspace' }]
    });

    const actual = { apiToken: '' };
    sinon.stub(systemModel, 'upsertClickUp').callsFake((_, result) => {
      actual.apiToken = result.apiToken;
      return Promise.reject(Error('fail'));
    });

    request(createApp())
      .post('/c?incognitoMode=true')
      .send(expected)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('stores public integration details from successful ClickUp workspace request', async () => {
    const mockWorkspace = {
      id: '123',
      name: 'Test Workspace',
      members: [
        { id: '456', username: 'testuser', email: 'test@example.com' }
      ]
    };

    const expected = {
      member: '456',
      clickupUsername: 'testuser',
      clickupEmail: 'test@example.com',
      clickupWorkspaceName: 'Test Workspace',
    };

    // Stubs
    sinon.stub(clickupService, 'fetchTeams').resolves({
      teams: [mockWorkspace]
    });

    const actual = {
      member: '',
      clickupUsername: '',
      clickupEmail: '',
      clickupWorkspaceName: '',
    };
    sinon.stub(systemModel, 'upsertClickUp').resolves();
    sinon.stub(integrationsModel, 'upsertClickUp').callsFake((_, result) => {
      actual.member = result.member;
      actual.clickupUsername = result.clickupUsername;
      actual.clickupEmail = result.clickupEmail;
      actual.clickupWorkspaceName = result.clickupWorkspaceName;
      return Promise.reject(Error('fail'));
    });

    await request(createApp())
      .post('/c?incognitoMode=true')
      .send({ apiToken: 'valid_token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500);

    expect(actual).to.deep.equal(expected);
  });

  it('returns public ClickUp integration data as successful response', done => {
    const mockWorkspace = {
      id: '123',
      name: 'Test Workspace',
      members: [
        { id: '456', username: 'testuser', email: 'test@example.com' }
      ]
    };

    const integrationData = {
      member: '456',
      clickupUsername: 'testuser',
      clickupEmail: 'test@example.com',
      clickupWorkspaceName: 'Test Workspace',
      createdAt: 1234567890
    };

    const expected = {
      data: {
        id: 'clickup',
        type: 'integration',
        attributes: JSON.parse(JSON.stringify(integrationData)),
      },
    };

    sinon.stub(clickupService, 'fetchTeams').resolves({
      teams: [mockWorkspace]
    });

    sinon.stub(systemModel, 'upsertClickUp').resolves();
    sinon.stub(integrationsModel, 'upsertClickUp').resolves(integrationData);

    request(createApp())
      .post('/c?incognitoMode=true')
      .send({ apiToken: 'valid_token' })
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
    const expected = 'ClickUp Integration Added';
    const mockWorkspace = {
      id: '123',
      name: 'Test Workspace',
      members: [
        { id: '456', username: 'testuser', email: 'test@example.com' }
      ]
    };

    const integrationData = {
      member: '456',
      clickupUsername: 'testuser',
      clickupEmail: 'test@example.com',
      clickupWorkspaceName: 'Test Workspace',
      createdAt: 1234567890
    };

    // Stubs
    sinon.stub(clickupService, 'fetchTeams').resolves({
      teams: [mockWorkspace]
    });
    sinon.stub(systemModel, 'upsertClickUp').resolves();
    sinon.stub(integrationsModel, 'upsertClickUp').resolves(integrationData);
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post('/c')
      .send({ apiToken: 'valid_token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || {}).title || '';
    expect(actual).to.equal(expected);
  });

  it('does not send notification upon success in incognito mode', async () => {
    const expected = false;
    const mockWorkspace = {
      id: '123',
      name: 'Test Workspace',
      members: [
        { id: '456', username: 'testuser', email: 'test@example.com' }
      ]
    };

    const integrationData = {
      member: '456',
      clickupUsername: 'testuser',
      clickupEmail: 'test@example.com',
      clickupWorkspaceName: 'Test Workspace',
      createdAt: 1234567890
    };

    // Stubs
    sinon.stub(clickupService, 'fetchTeams').resolves({
      teams: [mockWorkspace]
    });
    sinon.stub(systemModel, 'upsertClickUp').resolves();
    sinon.stub(integrationsModel, 'upsertClickUp').resolves(integrationData);
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post('/c?incognitoMode=true')
      .send({ apiToken: 'valid_token' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = addNotification.calledOnce;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/c',
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