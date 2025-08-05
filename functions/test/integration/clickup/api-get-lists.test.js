const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const clickupService = require('../../../services/clickup');
const systemModel = require('../../../models/system');
const getLists = require('../../../clickup/api/get-lists');

describe('ClickUp | API | GET Lists', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when ClickUp credentials are not found', done => {
    const expected = 'Organization has not authorized ClickUp';

    sinon.stub(systemModel, 'findClickUp').resolves({ data: () => null });

    request(createApp())
      .get('/lists?spaceId=123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when neither spaceId nor folderId is provided', done => {
    const expected = 'Either spaceId or folderId query parameter is required';

    request(createApp())
      .get('/lists')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns folders and lists when browsing a space', done => {
    const mockFolders = [
      {
        id: 'f1',
        name: 'Test Folder 1',
        hidden: false,
        space: { id: '123' },
        task_count: 5
      },
      {
        id: 'f2',
        name: 'Test Folder 2',
        hidden: true,
        space: { id: '123' },
        task_count: 0
      }
    ];

    const mockLists = [
      {
        id: 'l1',
        name: 'Test List 1',
        orderindex: 0,
        status: 'red',
        priority: null,
        assignee: null,
        task_count: 10,
        due_date: null,
        start_date: null,
        folder: { id: 'f1' },
        space: { id: '123' },
        statuses: [
          { status: 'open', type: 'open', color: '#d3d3d3' },
          { status: 'closed', type: 'closed', color: '#6bc950' }
        ]
      }
    ];

    const expected = {
      data: [
        {
          id: 'f1',
          type: 'clickup-folder',
          attributes: {
            name: 'Test Folder 1',
            hidden: false,
            taskCount: 5
          }
        },
        {
          id: 'f2',
          type: 'clickup-folder',
          attributes: {
            name: 'Test Folder 2',
            hidden: true,
            taskCount: 0
          }
        },
        {
          id: 'l1',
          type: 'clickup-list',
          attributes: {
            name: 'Test List 1',
            orderindex: 0,
            status: 'red',
            taskCount: 10,
            statusCount: 2,
            hasStatuses: true
          }
        }
      ],
      included: [
        {
          id: '123',
          type: 'clickup-space',
          attributes: {
            data: { id: '123', type: 'clickup-space' }
          }
        }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolders').resolves({ folders: mockFolders });
    sinon.stub(clickupService, 'fetchLists').resolves({ lists: mockLists });

    request(createApp())
      .get('/lists?spaceId=123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns only lists when browsing a folder', done => {
    const mockLists = [
      {
        id: 'l1',
        name: 'Folder List 1',
        orderindex: 0,
        status: 'blue',
        task_count: 3,
        folder: { id: 'f1' },
        space: { id: '123' },
        statuses: [
          { status: 'to do', type: 'open' },
          { status: 'done', type: 'closed' }
        ]
      }
    ];

    const expected = {
      data: [
        {
          id: 'l1',
          type: 'clickup-list',
          attributes: {
            name: 'Folder List 1',
            orderindex: 0,
            status: 'blue',
            taskCount: 3,
            statusCount: 2,
            hasStatuses: true
          }
        }
      ],
      included: [
        {
          id: 'f1',
          type: 'clickup-folder',
          attributes: {
            data: { id: 'f1', type: 'clickup-folder' }
          }
        }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolderLists').resolves({ lists: mockLists });

    request(createApp())
      .get('/lists?folderId=f1')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('handles lists with no statuses gracefully', done => {
    const mockLists = [
      {
        id: 'l1',
        name: 'No Status List',
        orderindex: 0,
        status: 'green',
        task_count: 1,
        folder: { id: 'f1' },
        space: { id: '123' },
        statuses: []
      }
    ];

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolderLists').resolves({ lists: mockLists });

    request(createApp())
      .get('/lists?folderId=f1')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const list = res.body.data[0];
        expect(list.attributes.statusCount).to.equal(0);
        expect(list.attributes.hasStatuses).to.equal(false);
        done();
      })
      .catch(done);
  });

  it('returns empty array when space has no folders or lists', done => {
    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolders').resolves({ folders: [] });
    sinon.stub(clickupService, 'fetchLists').resolves({ lists: [] });

    request(createApp())
      .get('/lists?spaceId=123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body.data).to.deep.equal([]);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp API request fails', done => {
    const expected = 'ClickUp API request failed';

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolders').rejects(Error('API error'));

    request(createApp())
      .get('/lists?spaceId=123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('passes correct parameters to ClickUp API calls', async () => {
    const spaceId = '123';
    const apiToken = 'valid_token';

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken })
    });
    const fetchFoldersStub = sinon.stub(clickupService, 'fetchFolders').resolves({ folders: [] });
    const fetchListsStub = sinon.stub(clickupService, 'fetchLists').resolves({ lists: [] });

    await request(createApp())
      .get(`/lists?spaceId=${spaceId}`)
      .expect(200);

    expect(fetchFoldersStub.calledWith(apiToken, spaceId)).to.equal(true);
    expect(fetchListsStub.calledWith(apiToken, spaceId, false)).to.equal(true);
  });

  it('fetches list details for status information', async () => {
    const mockLists = [
      {
        id: 'l1',
        name: 'Test List',
        orderindex: 0,
        status: 'red',
        task_count: 5,
        folder: { id: 'f1' },
        space: { id: '123' },
        statuses: []
      }
    ];

    const listDetails = {
      id: 'l1',
      statuses: [
        { status: 'open', type: 'open' },
        { status: 'in progress', type: 'custom' },
        { status: 'closed', type: 'closed' }
      ]
    };

    sinon.stub(systemModel, 'findClickUp').resolves({
      data: () => ({ apiToken: 'valid_token' })
    });
    sinon.stub(clickupService, 'fetchFolderLists').resolves({ lists: mockLists });
    const fetchListStub = sinon.stub(clickupService, 'fetchList').resolves(listDetails);

    const res = await request(createApp())
      .get('/lists?folderId=f1')
      .expect(200);

    expect(fetchListStub.calledWith('valid_token', 'l1')).to.equal(true);
    expect(res.body.data[0].attributes.statusCount).to.equal(3);
    expect(res.body.data[0].attributes.hasStatuses).to.equal(true);
  });
});

function createApp() {
  const app = express();
  app.get(
    '/lists',
    stubAuth,
    stubClickUpAuth,
    getLists({
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