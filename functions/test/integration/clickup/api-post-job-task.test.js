const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const integrationsModel = require('../../../models/integrations');
const systemModel = require('../../../models/system');
const notificationsModel = require('../../../models/notifications');
const clickupService = require('../../../services/clickup');
const postJobTask = require('../../../clickup/api/post-job-task');

describe('ClickUp | API | POST Job Task', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when property does not exist', done => {
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.equal('Property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when job does not exist', done => {
    const mockProperty = { name: 'Test Property' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.equal('Job not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when job is already complete', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'complete', // Job is already complete
      type: 'small:pm'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const error = res.body.errors.find(e => e.title && e.title.includes('Job is in complete state'));
        expect(error).to.exist;
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp task already exists', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm',
      clickupTaskURL: 'https://app.clickup.com/t/existing-task' // Job already has task URL
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.contain('Job already has an associated ClickUp task');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp integration is not configured', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('ClickUp integration details for property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when jobs list is not configured', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm'
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      // Missing jobsListId
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('ClickUp integration details for property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp jobs list cannot be accessed', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm'
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').rejects(Error('API error'));

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('Could not access ClickUp jobs list');
        done();
      })
      .catch(done);
  });

  it('creates ClickUp task successfully for job', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm',
      minBid: 500,
      maxBid: 1000,
      scopeOfWork: 'Fix the issue',
      clickupTaskURL: '',
      createdAt: 1234567890
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const mockListDetails = {
      statuses: [
        { status: 'NEEDS REVIEW', type: 'open', color: '#f9cb9c' },
        { status: 'APPROVED', type: 'custom', color: '#4dc3ff' }
      ]
    };
    const mockClickUpTask = {
      id: 'task456',
      name: 'Test Job',
      status: { status: 'NEEDS REVIEW' },
      url: 'https://app.clickup.com/t/task456'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] }); // No bids for this test

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/properties/:propertyId/jobs/:jobId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postJobTask(mockDb)
    );

    request(app)
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.id).to.equal('task456');
        expect(res.body.data.type).to.equal('clickup-task');
        expect(res.body.data.attributes.name).to.equal('Test Job');
        expect(res.body.data.attributes.status).to.equal('NEEDS REVIEW');
        expect(res.body.data.relationships.job.data.id).to.equal('job123');
        expect(res.body.data.relationships.property.data.id).to.equal('prop123');
        done();
      })
      .catch(done);
  });

  it('includes bid information when job has approved bids', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'authorized',
      type: 'small:pm',
      minBid: 500,
      maxBid: 1000,
      scopeOfWork: 'Fix the issue',
      trelloCardURL: ''
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const mockBids = [
      {
        id: 'bid123',
        state: 'approved',
        costEstimate: 750,
        vendorDetails: { name: 'Test Vendor' },
        completeAt: 1234567890 + 604800 // 1 week later
      }
    ];
    const mockListDetails = {
      statuses: [
        { status: 'AUTHORIZED', type: 'done', color: '#02c39a' }
      ]
    };
    const mockClickUpTask = {
      id: 'task456',
      name: 'Test Job',
      status: { status: 'AUTHORIZED' }
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    const mockJobDoc = { id: 'job123' };
    sinon.stub(jobsModel, 'createDocRef').returns(mockJobDoc);
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({
      docs: mockBids.map(bid => ({
        id: bid.id,
        data: () => bid
      }))
    });

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/properties/:propertyId/jobs/:jobId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postJobTask(mockDb)
    );

    request(app)
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.status).to.equal('AUTHORIZED');
        done();
      })
      .catch(done);
  });

  it('uses approved bid completion date as due date when available', done => {
    const mockProperty = { name: 'Test Property', zip: '10001' };
    const mockJob = {
      title: 'Test Job',
      state: 'authorized', // Important: must be authorized to lookup bids
      type: 'small:pm',
      targetCompletionDate: '2023-12-31', // This should be overridden by bid date
      clickupTaskURL: ''
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const completeAt = 1628528400; // Unix timestamp for approved bid
    const mockBids = [
      {
        id: 'bid123',
        state: 'approved',
        costEstimate: 750,
        vendorDetails: { name: 'Test Vendor' },
        completeAt
      }
    ];
    const mockListDetails = {
      statuses: [{ status: 'AUTHORIZED', type: 'done', color: '#02c39a' }]
    };
    const mockClickUpTask = {
      id: 'task456',
      name: 'Test Job',
      status: { status: 'AUTHORIZED' }
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    
    // Capture the task payload to verify due date
    let capturedTaskPayload = null;
    sinon.stub(clickupService, 'createTask').callsFake((token, listId, payload) => {
      capturedTaskPayload = payload;
      return Promise.resolve(mockClickUpTask);
    });
    
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    const mockJobDoc = { id: 'job123' };
    sinon.stub(jobsModel, 'createDocRef').returns(mockJobDoc);
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({
      docs: mockBids.map(bid => ({
        id: bid.id,
        data: () => bid
      }))
    });

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/properties/:propertyId/jobs/:jobId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postJobTask(mockDb)
    );

    request(app)
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.status).to.equal('AUTHORIZED');
        expect(capturedTaskPayload).to.not.be.null;
        expect(capturedTaskPayload.due_date).to.be.a('number');
        expect(capturedTaskPayload.due_date_time).to.equal(true);
        // Verify the due date corresponds to the bid completion date (end of day)
        const expectedDate = new Date(completeAt * 1000);
        expectedDate.setHours(23, 59, 59, 999); // End of day
        const allowedDifference = 24 * 60 * 60 * 1000; // 1 day tolerance
        expect(Math.abs(capturedTaskPayload.due_date - expectedDate.getTime())).to.be.lessThan(allowedDifference);
        done();
      })
      .catch(done);
  });

  it('handles ClickUp task creation failure gracefully', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm'
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const mockListDetails = {
      statuses: [{ status: 'NEEDS REVIEW', type: 'open' }]
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').rejects(Error('ClickUp API failed'));
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] }); // No bids for this test

    request(createApp())
      .post('/properties/prop123/jobs/job123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('Failed to create ClickUp task');
        done();
      })
      .catch(done);
  });

  it('supports notification creation when notify=true', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm',
      scopeOfWork: 'Fix the issue'
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const mockListDetails = { statuses: [{ status: 'NEEDS REVIEW', type: 'open' }] };
    const mockClickUpTask = {
      id: 'task456',
      name: 'Test Job',
      status: { status: 'NEEDS REVIEW' }
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] }); // No bids for this test
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/properties/:propertyId/jobs/:jobId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postJobTask(mockDb)
    );

    request(app)
      .post('/properties/prop123/jobs/job123/clickup/task?notify=true')
      .expect(201)
      .then(res => {
        expect(notificationStub.called).to.equal(true);
        const notificationData = notificationStub.firstCall.args[1];
        expect(notificationData.title).to.equal('ClickUp Task Created for Job');
        expect(notificationData.creator).to.equal('123');
        expect(notificationData.property).to.equal('prop123');
        done();
      })
      .catch(done);
  });

  it('skips notifications in incognito mode', done => {
    const mockProperty = { name: 'Test Property' };
    const mockJob = {
      title: 'Test Job',
      state: 'approved',
      type: 'small:pm'
    };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };
    const mockListDetails = { statuses: [{ status: 'NEEDS REVIEW', type: 'open' }] };
    const mockClickUpTask = {
      id: 'task456',
      name: 'Test Job',
      status: { status: 'NEEDS REVIEW' }
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(jobsModel, 'findRecord').resolves({ data: () => mockJob });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] }); // No bids for this test
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/properties/:propertyId/jobs/:jobId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postJobTask(mockDb)
    );

    request(app)
      .post('/properties/prop123/jobs/job123/clickup/task?notify=true&incognitoMode=true')
      .expect(201)
      .then(res => {
        expect(notificationStub.called).to.equal(false);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.use(express.json());
  
  // Add default stubs for createApp
  if (!jobsModel.findAssociatedBids.restore) {
    sinon.stub(jobsModel, 'findAssociatedBids').resolves({ docs: [] });
  }
  
  app.post(
    '/properties/:propertyId/jobs/:jobId/clickup/task',
    stubAuth,
    stubClickUpAuth,
    postJobTask({
      batch: () => ({
        update: () => {},
        commit: () => Promise.resolve()
      }),
      collection: () => ({
        doc: () => ({})
      })
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { 
    id: '123', 
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  };
  next();
}

function stubClickUpAuth(req, res, next) {
  req.clickupCredentials = { apiToken: 'valid_token' };
  next();
}