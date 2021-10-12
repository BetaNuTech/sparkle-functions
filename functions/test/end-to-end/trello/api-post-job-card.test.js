const nock = require('nock');
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const integrationsModel = require('../../../models/integrations');
const handler = require('../../../trello/api/post-job-card');
const { fs } = require('../../setup');

const CLIENT_API_DOMAIN =
  'test-app.com/properties/{{propertyId}}/jobs/edit/{{jobId}}';
const DEFAULT_ZIP = '10001';

describe('Trello | API | POST Job Card', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(null, fs);
  });

  it('successfully update system property trello card and job with created Trello card details', async () => {
    const cardId = uuid();
    const cardUrl = 'test.com/image.png';
    const jobId = uuid();
    const propertyId = uuid();
    const property = mocking.createProperty();
    const propertyDoc = propertiesModel.createDocRef(fs, propertyId);
    const job = mocking.createJob({ property: propertyDoc, trelloCardURL: '' });
    const trelloIntegration = { member: uuid(), trelloUsername: 'user' };
    const trelloPropIntegration = mocking.createPropertyTrelloIntegration();

    // Stub API
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${trelloPropIntegration.openList}&keyFromSource=all&key=key&token=token`
      )
      .reply(200, {
        id: cardId,
        shortUrl: cardUrl,
      });

    // Setup Database
    await propertiesModel.createRecord(fs, propertyId, property);
    await jobsModel.createRecord(fs, jobId, job);
    await integrationsModel.upsertTrello(fs, trelloIntegration);
    await integrationsModel.createTrelloProperty(
      fs,
      propertyId,
      trelloPropIntegration
    );

    // Execute
    const app = createApp();
    const res = await request(app)
      .post(`/t/${propertyId}/${jobId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const systemDoc = await systemModel.findTrelloProperty(fs, propertyId);
    const jobDoc = await jobsModel.findRecord(fs, jobId);
    const resAttrs = ((res.body || {}).data || {}).attributes || {};
    const expectedResponse = JSON.stringify({
      id: jobId,
      type: 'job',
      attributes: {
        updatedAt: resAttrs.updatedAt || 0,
        trelloCardURL: cardUrl,
      },
    });

    // Assertions
    [
      {
        actual: ((systemDoc.data() || {}).cards || {})[cardId] || '',
        expected: jobId,
        msg: 'added card reference to system trello properties',
      },
      {
        actual: (jobDoc.data() || {}).trelloCardURL || '',
        expected: cardUrl,
        msg: 'added card reference to system trello properties',
      },
      {
        actual: JSON.stringify(res.body.data),
        expected: expectedResponse,
        msg: 'created JSON-API response for job document',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId/:jobId',
    stubAuth,
    stubTrelloReq,
    handler(fs, CLIENT_API_DOMAIN, DEFAULT_ZIP)
  );
  return app;
}

function stubTrelloReq(req, res, next) {
  req.trelloCredentials = {
    authToken: 'token',
    apikey: 'key',
  };
  next();
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
