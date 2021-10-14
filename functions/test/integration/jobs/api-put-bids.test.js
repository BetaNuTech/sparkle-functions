const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const jobsModel = require('../../../models/jobs');
const bidsModel = require('../../../models/bids');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../jobs/api/put-bid');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const USER_ID = '123';
const propertyId = uuid();
const jobId = uuid();
const bidId = uuid();

describe('Jobs | API | PUT Bid', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request on missing update payload', async () => {
    const expected = 'Bad Request: bid update body required';
    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects when payload contains non-updatable attributes', async () => {
    const expected = 'Can not update non-updatable attributes';
    const update = { vendor: 'test', invalid: 'invalid' };

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    const [error] = res.body.errors;
    expect(error.detail).to.equal(expected);
  });

  it('rejects request to update bid with invalid update payload', async () => {
    const expected = 'costMin';
    const invalidUpdate = { costMin: '1' };

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const actual = (res.body.errors || []).reduce((acc, err) => {
      const pointer = (err.source || {}).pointer || '';
      acc += pointer;
      return acc;
    }, ''); // combine all error pointers
    expect(actual).to.equal(expected);
  });

  it('rejects request to update bid with non-existent property', async () => {
    const expected = 'Property not found';
    const update = { vendorDetails: 'test' };

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update bid with non-existent job', async () => {
    const expected = 'Job not found';
    const update = { vendorDetails: 'test' };
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    // Stub Requests
    sinon.stub(jobsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update non-existent bid', async () => {
    const expected = 'Bid not found';
    const update = { vendorDetails: 'test' };
    const property = mocking.createProperty();
    const job = mocking.createJob();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon.stub(bidsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it("rejects request to update bid to approved if bid's job already has an approved bid", async () => {
    const expected = 'Job already has approved bids';
    const update = { state: 'approved' };
    const property = mocking.createProperty();
    const job = mocking.createJob();
    const jobDoc = firebase.createDocRef();
    const bid = mocking.createBid({ job: jobDoc });
    const approvedBid = mocking.createBid({ state: 'approved', job: jobDoc });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(bidsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    sinon
      .stub(bidsModel, 'queryJobsApproved')
      .resolves(firebase.createQuerySnapshot([approvedBid]));

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects transition to approved, from open, if bid does not contain required attributes', async () => {
    const expected = 'completeAt,costMax,costMin,startAt';
    const update = { state: 'approved' };
    const property = mocking.createProperty();
    const job = mocking.createJob();
    const jobDoc = firebase.createDocRef();
    const bid = mocking.createBid({
      state: 'open',
      costMin: 0,
      costMax: 0,
      startAt: 0,
      completeAt: 0,
      job: jobDoc,
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(bidsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    sinon
      .stub(bidsModel, 'queryJobsApproved')
      .resolves(firebase.createQuerySnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409);

    // Assertions
    const errors = res.body.errors || [];
    const sources = errors.map(err => err.source || null).filter(Boolean);
    const actual = sources
      .map(src => src.pointer || '')
      .filter(Boolean)
      .sort()
      .join(',');
    expect(actual).to.equal(expected);
  });

  it('rejects transition to approved when user lacks permission level for the job type', async () => {
    const expected = 'job';
    const update = { state: 'approved' };
    const property = mocking.createProperty();
    const job = mocking.createJob({
      type: 'large:am', // requires admin
    });
    const jobDoc = firebase.createDocRef();
    const readyToApproveBid = mocking.createBid({
      state: 'open',
      costMin: 1,
      costMax: 2,
      startAt: 1,
      completeAt: 2,
      job: jobDoc,
    });
    // Corporate users cannot approve large jobs
    const corporateUser = mocking.createUser({ corporate: true });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(bidsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(bidId, readyToApproveBid));
    sinon
      .stub(bidsModel, 'queryJobsApproved')
      .resolves(firebase.createQuerySnapshot()); // empty

    const res = await request(createApp(corporateUser))
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403);

    // Assertions
    const errors = res.body.errors || [];
    const sources = errors.map(err => err.source || null).filter(Boolean);
    const actual = sources
      .map(src => src.pointer || '')
      .filter(Boolean)
      .sort()
      .join(',');
    expect(actual).to.equal(expected);
  });

  it("regresses a bid's job from authorized to approved when the bid becomes incomplete or rejected", async () => {
    const expected = true;
    const update = { state: 'complete' };
    const property = mocking.createProperty();
    const propDoc = firebase.createDocRef();
    const job = mocking.createJob({
      state: 'authorized',
      property: propDoc,
    });
    const jobDoc = firebase.createDocRef();
    const bid = mocking.createBid({
      state: 'approved',
      job: jobDoc,
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(bidsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    sinon
      .stub(bidsModel, 'queryJobsApproved')
      .resolves(firebase.createQuerySnapshot()); // empty
    sinon
      .stub(bidsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    const updateJob = sinon.stub(jobsModel, 'updateRecord').resolves();

    await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = updateJob.called;
    expect(actual).to.equal(expected);
  });

  it("completes the job when its' bid becomes complete", async () => {
    const expected = 'complete';
    const update = { state: 'complete' };
    const property = mocking.createProperty();
    const propDoc = firebase.createDocRef();
    const job = mocking.createJob({
      state: 'authorized',
      property: propDoc,
    });
    const jobDoc = firebase.createDocRef();
    const bid = mocking.createBid({
      state: 'approved',
      costMin: 1,
      costMax: 2,
      startAt: 1,
      completeAt: 2,
      job: jobDoc,
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(bidsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    sinon
      .stub(bidsModel, 'queryJobsApproved')
      .resolves(firebase.createQuerySnapshot()); // empty
    sinon
      .stub(bidsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));
    const updateJob = sinon.stub(jobsModel, 'updateRecord').resolves();

    await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = updateJob.firstCall || { args: [] };
    const actual = (result.args[2] || {}).state || '';
    expect(actual).to.equal(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.put(
    '/t/:propertyId/:jobId/:bidId',
    bodyParser.json(),
    stubAuth(user),
    handler({
      collection: () => {},
      batch: () => ({
        update: () => {},
        commit: () => Promise.resolve(),
      }),
    })
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: USER_ID, admin: true }, user);
    next();
  };
}
