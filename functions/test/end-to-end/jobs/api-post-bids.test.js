const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../jobs/api/post-bid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const jobsModel = require('../../../models/jobs');

describe('Jobs | API | POST Bid', () => {
  afterEach(() => cleanDb(null, fs));

  it('returns the bid document on successful creation', async () => {
    const expected = 'bid';
    const propertyId = uuid();
    const jobId = uuid();
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(fs, propertyId);
    const job = mocking.createJob({ property: propertyDoc });
    const jobDoc = jobsModel.createDocRef(fs, jobId);
    const bid = mocking.createBid({ job: jobDoc });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, property);
    await jobsModel.createRecord(fs, jobId, job);

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
  app.post('/t/:propertyId/:jobId/', bodyParser.json(), handler(fs));
  return app;
}
