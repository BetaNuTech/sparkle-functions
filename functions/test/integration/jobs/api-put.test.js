const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const put = require('../../../jobs/api/put');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const USER_ID = uuid();
const JOB_ID = uuid();
const PROPERTY_ID = uuid();

describe('Jobs | API | PUT', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request for missing update payload', async () => {
    const expected = 'Bad Request: job update body required';

    // Execute
    const res = await request(createApp())
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update job with invalid update payload', async () => {
    const expected = 'title';
    const invalidUpdate = { title: 1 };

    // Execute
    const res = await request(createApp())
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const { source = {} } = error;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update job with non-existent property', async () => {
    const expected = 'Property not found';
    const update = { state: 'approved' };

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    // Execute
    const res = await request(createApp())
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update job with non-existent job', async () => {
    const expected = 'Job not found';
    const update = { state: 'approved' };
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon.stub(jobsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    // Execute
    const res = await request(createApp())
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('forbids authorization rule update by non-admin', async () => {
    const update = { authorizedRules: 'expedite' }; // only admins can expedite jobs
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({ property: propertyRef });
    const unpermissionedUser = mocking.createUser({
      admin: false,
    });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    // Execute
    await request(createApp(unpermissionedUser))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403); // Assertion
  });

  it('rejects when payload contains non-updatable attributes', async () => {
    const expected = 'Can not update non-updatable attributes';
    const update = { state: 'open', invalid: 'invalid' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({ property: propertyRef });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    // Execute
    const res = await request(createApp())
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.contain(expected);
  });

  it('rejects request to transition job state when job lacks minimum bids requirements', async () => {
    const expected = 'minBids';
    const update = { state: 'authorized' };
    const admin = mocking.createUser({ admin: true });
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      type: 'small:pm',
      minBids: 2, // requires 2 bids
    });
    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid])); // only 1 bid

    // Execute
    const res = await request(createApp(admin))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400); // Assertion

    // Assertions
    const [error] = res.body.errors || [];
    const source = error.source || {};
    const actual = source.pointer || '';
    expect(actual).to.contain(expected);
  });

  it('rejects transition to approved when user lacks permission level for the job type', async () => {
    const expected = 'type';
    const update = { state: 'approved' };
    const propertyId = uuid();
    const jobId = uuid();
    const property = mocking.createProperty();
    const job = mocking.createJob({
      type: 'large:am', // requires admin
    });
    const jobRef = firebase.createDocRef({ id: jobId });

    // Corporate users cannot approve large jobs
    const corporateUser = mocking.createUser({ corporate: true });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot()); // empty

    // Execute
    const res = await request(createApp(corporateUser))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403); // Assertion

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

  it('rejects transitioning a job to authorized when it lacks approved bid requirement', async () => {
    const expected = 'bids';
    const update = { state: 'authorized' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      authorizedRules: 'default',
      type: 'small:pm',
      minBids: 2, // requires 2 bids
    });
    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'open' });
    const bid2 = mocking.createBid({ job: jobRef, state: 'open' });
    const admin = mocking.createUser({ admin: true });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid, bid2]));
    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, update));

    // Execute
    const res = await request(createApp(admin))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400); // assertion

    // Assertions
    const [error] = res.body.errors || [];
    const source = error.source || {};
    const actual = source.pointer || '';
    expect(actual).to.contain(expected);
  });

  it('forbids non-admin from transitioning an expedited job to authorized', async () => {
    const update = { state: 'authorized' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      authorizedRules: 'expedite',
      minBids: 1,
    });
    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' }); // meets bid requirements
    const unpermissionedUser = mocking.createUser({ admin: false });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid]));
    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, update));

    // Execute
    await request(createApp(unpermissionedUser))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403);
  });

  it('should update new min bids when authorized rules are expedited', async () => {
    const update = { authorizedRules: 'expedite' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      authorizedRules: 'default',
      minBids: 3,
    });

    const clonedJob = JSON.parse(JSON.stringify(job));
    clonedJob.minBids = 1;
    clonedJob.authorizedRules = update.authorizedRules;
    delete clonedJob.property;

    const expected = {
      data: {
        attributes: clonedJob,
        id: JOB_ID,
        type: 'job',
        relationships: {
          property: {
            data: {
              id: PROPERTY_ID,
              type: 'property',
            },
          },
        },
      },
    };

    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' });
    const admin = mocking.createUser({ admin: true });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid]));
    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, update));

    // Execute
    const res = await request(createApp(admin))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body;
    expect(actual).to.deep.equal(expected);
  });

  it('should update new min bids and authoriztion rules when job type increases to large', async () => {
    const update = { type: 'large:am' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      type: 'small:pm',
      authorizedRules: 'default',
      minBids: 2,
    });

    const clonedJob = JSON.parse(JSON.stringify(job));
    clonedJob.minBids = 3;
    clonedJob.authorizedRules = 'large';
    clonedJob.type = update.type;
    delete clonedJob.property;

    const expected = {
      data: {
        attributes: clonedJob,
        id: JOB_ID,
        type: 'job',
        relationships: {
          property: {
            data: {
              id: PROPERTY_ID,
              type: 'property',
            },
          },
        },
      },
    };

    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' });
    const admin = mocking.createUser({ admin: true });

    // Stubs
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(jobsModel, 'createDocRef').returns(jobRef);
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid]));
    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, update));

    // Execute
    const res = await request(createApp(admin))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body;
    expect(actual).to.deep.equal(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.put(
    '/t/:propertyId/:jobId',
    bodyParser.json(),
    stubAuth(user),
    put({ collection: () => {} })
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: USER_ID }, user);
    next();
  };
}
