const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const clickupService = require('../../../services/clickup');
const systemModel = require('../../../models/system');
const getSpaces = require('../../../clickup/api/get-spaces');

describe('ClickUp | API | GET Spaces', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when ClickUp credentials are not found', done => {
    const expected = 'Organization has not authorized ClickUp';

    // Create app without ClickUp auth middleware to simulate missing credentials
    const app = express();
    app.get('/spaces/:workspaceId', stubAuth, getSpaces({ collection: () => {} }));

    request(app)
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when workspaceId is missing', done => {
    const expected = 'workspaceId';

    request(createApp())
      .get('/spaces/')
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
    sinon.stub(clickupService, 'fetchSpaces').rejects(Error('API error'));

    request(createApp())
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns empty array when workspace has no spaces', done => {
    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchSpaces').resolves({ spaces: [] });

    request(createApp())
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body.data).to.deep.equal([]);
        done();
      })
      .catch(done);
  });

  it('returns all spaces as JSON-API formatted records', done => {
    const mockSpaces = [
      {
        id: '456',
        name: 'Test Space 1',
        color: '#ff0000',
        avatar: 'space1.jpg',
        private: false,
        statuses: [
          { status: 'open', type: 'open' },
          { status: 'in progress', type: 'custom' }
        ],
        multiple_assignees: true
      },
      {
        id: '789',
        name: 'Test Space 2',
        color: '#00ff00',
        avatar: null,
        private: true,
        statuses: [
          { status: 'to do', type: 'open' },
          { status: 'done', type: 'closed' }
        ],
        multiple_assignees: false
      }
    ];

    const expected = {
      data: [
        {
          id: '456',
          type: 'clickup-space',
          attributes: {
            name: 'Test Space 1',
            color: '#ff0000',
            avatar: 'space1.jpg',
            private: false,
            statusCount: 2,
            multipleAssignees: true,
            folderCount: 0
          }
        },
        {
          id: '789',
          type: 'clickup-space',
          attributes: {
            name: 'Test Space 2',
            color: '#00ff00',
            avatar: null,
            private: true,
            statusCount: 2,
            multipleAssignees: false,
            folderCount: 0
          }
        }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchSpaces').resolves({ spaces: mockSpaces });
    sinon.stub(clickupService, 'fetchFolders').resolves({ folders: [] });

    request(createApp())
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('includes folder count for each space', async () => {
    const mockSpaces = [
      { id: '456', name: 'Space 1', color: '#ff0000' },
      { id: '789', name: 'Space 2', color: '#00ff00' }
    ];

    const space1Folders = { folders: [{ id: 'f1' }, { id: 'f2' }] };
    const space2Folders = { folders: [{ id: 'f3' }] };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchSpaces').resolves({ spaces: mockSpaces });
    const fetchFoldersStub = sinon.stub(clickupService, 'fetchFolders');
    fetchFoldersStub.withArgs('valid_token', '456').resolves(space1Folders);
    fetchFoldersStub.withArgs('valid_token', '789').resolves(space2Folders);

    const res = await request(createApp())
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    expect(res.body.data[0].attributes.folderCount).to.equal(2);
    expect(res.body.data[1].attributes.folderCount).to.equal(1);
  });

  it('handles API errors when fetching folder counts gracefully', done => {
    const mockSpaces = [
      { id: '456', name: 'Space 1', color: '#ff0000' }
    ];

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchSpaces').resolves({ spaces: mockSpaces });
    sinon.stub(clickupService, 'fetchFolders').rejects(Error('Folder API error'));

    request(createApp())
      .get('/spaces/123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body.data[0].attributes.folderCount).to.equal(0);
        done();
      })
      .catch(done);
  });

  it('passes correct workspaceId to ClickUp API', async () => {
    const workspaceId = '123';
    const mockSpaces = [{ id: '456', name: 'Test Space' }];

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    const fetchSpacesStub = sinon.stub(clickupService, 'fetchSpaces').resolves({ spaces: mockSpaces });
    sinon.stub(clickupService, 'fetchFolders').resolves({ folders: [] });

    await request(createApp())
      .get(`/spaces/${workspaceId}`)
      .expect(200);

    expect(fetchSpacesStub.calledWith('valid_token', workspaceId)).to.equal(true);
  });
});

function createApp() {
  const app = express();
  app.get(
    '/spaces/:workspaceId',
    stubAuth,
    stubClickUpAuth,
    getSpaces({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  // Handle missing workspaceId case
  app.get(
    '/spaces/',
    stubAuth,
    stubClickUpAuth,
    getSpaces({
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