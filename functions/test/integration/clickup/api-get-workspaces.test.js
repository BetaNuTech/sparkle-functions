const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const clickupService = require('../../../services/clickup');
const systemModel = require('../../../models/system');
const getWorkspaces = require('../../../clickup/api/get-workspaces');

describe('ClickUp | API | GET Workspaces', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when ClickUp credentials are not found', done => {
    const expected = 'Organization has not authorized ClickUp';

    // Create app without ClickUp auth middleware to simulate missing credentials
    const app = express();
    app.get('/workspaces', stubAuth, getWorkspaces({ collection: () => {} }));

    request(app)
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp API request fails', done => {
    const expected = 'ClickUp API request failed';

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchTeams').rejects(Error('API error'));

    request(createApp())
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns empty array when user has no accessible workspaces', done => {
    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchTeams').resolves({ teams: [] });

    request(createApp())
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body.data).to.deep.equal([]);
        done();
      })
      .catch(done);
  });

  it('returns all accessible workspaces as JSON-API formatted records', done => {
    const mockWorkspaces = [
      {
        id: '123',
        name: 'Test Workspace 1',
        color: '#ff0000',
        avatar: 'avatar1.jpg',
        members: [{ id: '456', username: 'user1' }]
      },
      {
        id: '789',
        name: 'Test Workspace 2',
        color: '#00ff00',
        avatar: null,
        members: [{ id: '012', username: 'user2' }]
      }
    ];

    const expected = {
      data: [
        {
          id: '123',
          type: 'clickup-workspace',
          attributes: {
            name: 'Test Workspace 1',
            color: '#ff0000',
            avatar: 'avatar1.jpg',
            memberCount: 1
          }
        },
        {
          id: '789',
          type: 'clickup-workspace',
          attributes: {
            name: 'Test Workspace 2',
            color: '#00ff00',
            avatar: null,
            memberCount: 1
          }
        }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchTeams').resolves({ teams: mockWorkspaces });

    request(createApp())
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('includes member count in workspace attributes', done => {
    const mockWorkspace = {
      id: '123',
      name: 'Test Workspace',
      color: '#7b68ee',
      avatar: null,
      members: [
        { id: '456', username: 'user1' },
        { id: '789', username: 'user2' },
        { id: '012', username: 'user3' }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchTeams').resolves({ teams: [mockWorkspace] });

    request(createApp())
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const memberCount = res.body.data[0].attributes.memberCount;
        expect(memberCount).to.equal(3);
        done();
      })
      .catch(done);
  });

  it('handles workspaces with no members gracefully', done => {
    const mockWorkspace = {
      id: '123',
      name: 'Empty Workspace',
      color: '#7b68ee',
      avatar: null,
      members: []
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchTeams').resolves({ teams: [mockWorkspace] });

    request(createApp())
      .get('/workspaces')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const memberCount = res.body.data[0].attributes.memberCount;
        expect(memberCount).to.equal(0);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get(
    '/workspaces',
    stubAuth,
    stubClickUpAuth,
    getWorkspaces({
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

function stubClickUpAuth(req, res, next) {
  req.clickupCredentials = { apiToken: 'valid_token' };
  next();
}