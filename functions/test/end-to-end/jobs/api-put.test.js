const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const handler = require('../../../jobs/api/put');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs } = require('../../setup');

describe('Jobs | API | PUT', () => {
  afterEach(() => cleanDb(null, fs));

  it('should update an existing job', async () => {
    const update = {
      title: 'Updated',
      need: 'Updated',
      scopeOfWork: 'Updated',
      trelloCardURL: 'trello.com/card/1',
    };
    const jobId = uuid();
    const propertyId = uuid();
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(fs, propertyId);
    const job = mocking.createJob({ property: propertyDoc });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, property);
    await jobsModel.createRecord(fs, jobId, job);

    // Execute
    const app = createApp();
    const res = await request(app)
      .put(`/t/${propertyId}/${jobId}`)
      .send(update)
      .expect('Content-Type', /json/)
      .expect(201);

    // Setup Expectation
    const updatedJob = await jobsModel.findRecord(fs, jobId);
    const updateJobData = { ...updatedJob.data(), ...update };
    delete updateJobData.property;
    const expected = {
      id: jobId,
      type: 'job',
      attributes: updateJobData,
      relationships: {
        property: {
          data: {
            id: propertyId,
            type: 'property',
          },
        },
      },
    };

    // Assertions
    const body = res ? res.body : {};
    const actual = body ? body.data : {};
    expect(actual).to.deep.equal(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.put(
    '/t/:propertyId/:jobId',
    bodyParser.json(),
    stubAuth(user),
    handler(fs)
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: uuid() }, user);
    next();
  };
}
