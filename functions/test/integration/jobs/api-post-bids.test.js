const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const bidsModel = require('../../../models/bids');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const post = require('../../../jobs/api/post-bid');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const propertyId = uuid();
const jobId = uuid();

describe('Bids | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to create bid without required payload', async () => {
    const expected = 'vendor';
    const res = await request(createApp())
      .post(`/t/${propertyId}/${jobId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result[0].source.pointer;
    expect(actual).to.equal(expected);
  });

  it('rejects request to create bid with non-existent property', async () => {
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${propertyId}/${jobId}`)
      .send({ vendor: 'test' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create bid with non-existent job', async () => {
    const expected = 'Job not found';
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon.stub(jobsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${propertyId}/${jobId}`)
      .send({ vendor: 'test' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns the bid document on successful creation', async () => {
    const property = mocking.createProperty();
    const job = mocking.createJob();
    const bid = mocking.createBid();
    const bidId = uuid();
    delete bid.job; // sanity check

    const expected = {
      data: {
        id: bidId,
        type: 'bid',
        attributes: { ...bid },
        relationships: {
          job: {
            data: {
              id: jobId,
              type: 'job',
            },
          },
        },
      },
    };

    // Stup Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(jobId, job));
    sinon
      .stub(jobsModel, 'createDocRef')
      .returns(firebase.createDocRef({ id: jobId }));
    sinon.stub(bidsModel, 'createId').returns(bidId);
    sinon
      .stub(bidsModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(bidId, bid));

    // Execute
    const res = await request(createApp())
      .post(`/t/${propertyId}/${jobId}`)
      .send({ ...bid })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body;
    actual.data.attributes.createdAt = bid.createdAt; // allow different
    actual.data.attributes.updatedAt = bid.updatedAt; // allow different
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId/:jobId',
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
