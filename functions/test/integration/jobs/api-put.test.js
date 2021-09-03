const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const put = require('../../../jobs/api/put');
const stubs = require('../../../test-helpers/stubs');
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
      .stub(propertiesModel, 'firestoreFindRecord')
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
      .stub(propertiesModel, 'firestoreFindRecord')
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

  it('reject forbidden request to update job without necessary permission', async () => {
    const update = { authorizedRules: 'expedite' };
    const property = mocking.createProperty();
    const job = mocking.createJob();

    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    const unpermissionedUser = mocking.createUser({
      admin: false,
    });

    // Execute
    await request(createApp(unpermissionedUser))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403); // Assertion
  });

  it('rejects when  payload contains non-updatable attributes', async () => {
    const expected = 'Can not update non-updatable attributes';
    const update = { state: 'open', invalid: 'invalid' };
    const property = mocking.createProperty();
    const job = mocking.createJob();

    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
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

  it('forbids transitioning a job to authorized when it only has a single approved bid', async () => {
    const update = { state: 'authorized' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      authorizedRules: 'default',
    });
    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' });
    const user = mocking.createUser({ admin: true });
    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(jobsModel, 'createDocRef')
      .returns(jobRef)
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid]));

      sinon
        .stub(jobsModel, 'updateRecord')
        .resolves(firebase.createDocSnapshot(JOB_ID, update));
      
    // Execute
    await request(createApp(user))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403); // assertion
  });

  it('accepts admins transitioning a expedited job to authorized when it only has a single approved bid', async () => {
    const update = { state: 'authorized' };
    const property = mocking.createProperty();
    const propertyRef = firebase.createDocRef({ id: PROPERTY_ID });
    const job = mocking.createJob({
      property: propertyRef,
      state: 'approved',
      authorizedRules: 'expedite',
    });
    const jobRef = firebase.createDocRef({ id: JOB_ID });
    const bid = mocking.createBid({ job: jobRef, state: 'approved' });
    const user = mocking.createUser({ admin: true });
    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(jobsModel, 'createDocRef')
      .returns(jobRef)
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(firebase.createQuerySnapshot([bid]));
    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, update));

    // Execute
    await request(createApp(user))
      .put(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201); // assertion
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
