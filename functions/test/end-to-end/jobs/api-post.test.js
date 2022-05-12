const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../jobs/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Jobs | API | POST', () => {
  afterEach(() => cleanDb(db));

  it('should create a new job for a property', async () => {
    const expected = {
      title: 'Wall painting',
      need: 'Discolored wall',
      scopeOfWork: 'Need to paint the wall',
      type: config.jobs.typeValues[0],
    };
    const propertyId = uuid();
    const property = mocking.createProperty();

    // Setup database
    await propertiesModel.createRecord(db, propertyId, property);

    // Execute
    const app = createApp();
    const res = await request(app)
      .post(`/t/${propertyId}`)
      .send(expected)
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const jobDoc = body ? body.data : {};
    const jobId = jobDoc.id || 'na';
    const job = await jobsModel.findRecord(db, jobId);
    const result = job.data() || {};
    const attrs = Object.keys(expected);
    const actual = attrs.reduce((acc, attr) => {
      acc[attr] = result[attr];
      return acc;
    }, {});

    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t/:propertyId', bodyParser.json(), handler(db));
  return app;
}
