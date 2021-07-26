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

const USER_ID = '123';
const propertyId = uuid();
const jobId = uuid();

describe('Jobs | API | PUT', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request for missing update payload', async () => {
    const expected = 'Bad Request: job update body required';
    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}`)
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

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}`)
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

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}`)
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
      .resolves(firebase.createDocSnapshot(propertyId, property));

    // Stub Requests
    sinon.stub(jobsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('reject forbidden request to update job without necessary permission', done => {
    const update = { authorizedRules: 'expedite' };
    const property = mocking.createProperty();
    const job = mocking.createJob();

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));

    const unpermissionedUser = mocking.createUser({
      admin: false,
    });

    request(createApp(unpermissionedUser))
      .put(`/t/${propertyId}/${jobId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403)
      .then(() => done())
      .catch(done);
  });

  it('rejects when  payload contains non-updatable attributes', async () => {
    const expected = 'Can not update non-updatable attributes';
    const update = { state: 'open', invalid: 'invalid' };
    const property = mocking.createProperty();
    const job = mocking.createJob();

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));

    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.contain(expected);
  });

  it('return the job document on successful update', async () => {
    const update = { state: 'authorized' };
    const property = mocking.createProperty();
    const job = mocking.createJob();
    job.id = jobId;
    job.state = 'approved';
    job.authorizedRules = 'expedite';
    job.property = property;
    const bids = [{ job: job.id, state: 'approved' }];

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(job.id, job));

    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(stubs.wrapSnapshot([bids]));

    sinon
      .stub(jobsModel, 'updateRecord')
      .resolves(firebase.createDocSnapshot(job.id, update));

    const permissionedUser = mocking.createUser({
      admin: true,
    });

    delete job.property;

    const expected = {
      id: job.id,
      type: 'job',
      attributes: { ...job, ...update },
      relationships: {
        property: {
          data: {
            id: propertyId,
            type: 'property',
          },
        },
      },
    };

    const res = await request(createApp(permissionedUser))
      .put(`/t/${propertyId}/${jobId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body.data;
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
