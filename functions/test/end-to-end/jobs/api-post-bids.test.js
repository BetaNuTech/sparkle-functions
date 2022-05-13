const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../jobs/api/post-bid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const jobsModel = require('../../../models/jobs');

describe('Jobs | API | POST Bid', () => {
  afterEach(() => cleanDb(db));

  it('returns the bid document on successful creation', async () => {
    const expected = 'bid';
    const propertyId = uuid();
    const jobId = uuid();
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(db, propertyId);
    const job = mocking.createJob({ property: propertyDoc });
    const jobDoc = jobsModel.createDocRef(db, jobId);
    const bid = mocking.createBid({ job: jobDoc });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);
    await jobsModel.createRecord(db, jobId, job);

    // Execute
    const res = await request(createApp())
      .post(`/t/${propertyId}/${jobId}`)
      .send(bid)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body.data.type;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t/:propertyId/:jobId/', bodyParser.json(), handler(db));
  return app;
}
