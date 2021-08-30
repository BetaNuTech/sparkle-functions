const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const post = require('../../../jobs/api/post');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Jobs | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to create job without required payloads', async () => {
    const expected = 'title, type';
    const res = await request(createApp())
      .post('/t/123')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.equal(expected);
  });

  it('rejects request to create job with non-existent property', async () => {
    const expected = 'Property not found';
    const job = mocking.createJob();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post('/t/123')
      .send({ ...job })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create job with invalid configuration', async () => {
    const expected = 'type';
    const propertyId = uuid();
    const invalidJob = mocking.createJob();
    invalidJob.type = 'invalid-type';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(
        firebase.createDocSnapshot(propertyId, mocking.createProperty())
      );
    sinon
      .stub(propertiesModel, 'createDocRef')
      .returns(firebase.createDocRef({ id: propertyId }));

    const res = await request(createApp())
      .post(`/t/${propertyId}`)
      .send({ ...invalidJob })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [result] = res.body.errors || [];
    const { source = {} } = result;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('returns the job JSON API document on successfull creation', done => {
    const propertyId = uuid();
    const jobId = uuid();
    const property = mocking.createProperty();
    const job = mocking.createJob();
    delete job.property; // sanity check
    delete job.trelloCardURL; // sanity check

    const expected = {
      data: {
        id: jobId,
        type: 'job',
        attributes: { ...job },
        relationships: {
          property: {
            data: {
              id: propertyId,
              type: 'property',
            },
          },
        },
      },
    };

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(propertiesModel, 'createDocRef')
      .returns(firebase.createDocRef({ id: propertyId }));
    sinon.stub(jobsModel, 'createId').returns(jobId);
    sinon
      .stub(jobsModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));

    request(createApp())
      .post(`/t/${propertyId}`)
      .send({ ...job })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId',
    bodyParser.json(),
    stubAuth,
    post({ collection: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
