const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../jobs/api/put-bid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const jobsModel = require('../../../models/jobs');
const bidsModel = require('../../../models/bids');

describe('Jobs | API | PUT Bid', () => {
  afterEach(() => cleanDb(null, fs));

  it('return the successfully updated bid on successful update', async () => {
    const propertyId = uuid();
    const jobId = uuid();
    const bidId = uuid();
    const update = { state: 'approved' };
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(fs, propertyId);
    const job = mocking.createJob({ property: propertyDoc });
    const jobDoc = jobsModel.createDocRef(fs, jobId);
    const bid = mocking.createBid({ state: 'open', job: jobDoc });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, property);
    await jobsModel.createRecord(fs, jobId, job);
    await bidsModel.createRecord(fs, bidId, bid);

    // Expected
    delete bid.job;
    const expected = {
      id: bidId,
      type: 'bid',
      attributes: { ...bid, ...update },
      relationships: {
        job: {
          data: {
            id: jobId,
            type: 'job',
          },
        },
      },
    };

    // Execute
    const res = await request(createApp())
      .put(`/t/${propertyId}/${jobId}/${bidId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body.data;
    expect(actual).deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put('/t/:propertyId/:jobId/:bidId', bodyParser.json(), handler(fs));
  return app;
}
