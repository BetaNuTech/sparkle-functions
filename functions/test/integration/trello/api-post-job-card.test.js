const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const moment = require('moment-timezone');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const trelloService = require('../../../services/trello');
const systemModel = require('../../../models/system');
const jobsModel = require('../../../models/jobs');
const propertiesModel = require('../../../models/properties');
const integrationsModel = require('../../../models/integrations');
const stubs = require('../../../test-helpers/stubs');
const handler = require('../../../trello/api/post-job-card');
const firebase = require('../../../test-helpers/firebase');
const toISO8601 = require('../../../trello/utils/date-to-iso-8601');
const log = require('../../../utils/logger');

const CLIENT_API_DOMAIN =
  'test-app.com/properties/{{propertyId}}/jobs/edit/{{jobId}}';
const DEFAULT_ZIP = '10001';
const PROPERTY_ID = uuid();
const JOB_ID = uuid();

describe('Trello | API | POST Job Card', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to create trello job card with non-existent property', async () => {
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create trello job card with non-existent job', async () => {
    const expected = 'Job not found';
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon.stub(jobsModel, 'findRecord').resolves(firebase.createDocSnapshot()); // empty

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create trello job card if the job already has an associated trello card', async () => {
    const expected = 'Job already has an associated trello card';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: 'exists.com/ok.jpg',
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create trello job card if the Job is already completed', async () => {
    const expected = 'Job is in complete state';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
      state: 'complete',
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns a helpful error when trello integration lookup failed', async () => {
    const expected = 'trello integration lookup failed';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon.stub(integrationsModel, 'firestoreFindTrello').rejects();

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create trello job card if the organization has not configured Trello', async () => {
    const expected = 'Trello is not integrated';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(integrationsModel, 'firestoreFindTrello')
      .resolves(firebase.createDocSnapshot());

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns a helpful error when Trello integration details are not set for property', async () => {
    const expected =
      'Trello integration details for property not found or invalid';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
    });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(integrationsModel, 'firestoreFindTrello')
      .resolves(firebase.createDocSnapshot('trello', { member: uuid() }));
    sinon
      .stub(integrationsModel, 'firestoreFindTrelloProperty')
      .resolves(firebase.createDocSnapshot());

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.detail : '';
    expect(actual).to.equal(expected);
  });

  it('returns a helpful error when Trello card publishing failed', async () => {
    const expected = 'Error from trello API';
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
    });
    const trelloIntegration = mocking.createPropertyTrelloIntegration();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(integrationsModel, 'firestoreFindTrello')
      .resolves(firebase.createDocSnapshot('trello', { member: uuid() }));
    sinon
      .stub(integrationsModel, 'firestoreFindTrelloProperty')
      .resolves(
        firebase.createDocSnapshot(`trello-${PROPERTY_ID}`, trelloIntegration)
      );
    sinon.stub(trelloService, 'publishListCard').rejects();

    // Execute
    const res = await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.detail : '';
    expect(actual).to.equal(expected);
  });

  it("adds any approved bids completion date as the trello card's due date", async () => {
    const completedAt = 1628528400;
    const dateStr = moment
      .unix(completedAt)
      .tz('America/New_York')
      .format('MM/DD/YYYY');
    const expected = toISO8601(dateStr, DEFAULT_ZIP);
    const property = mocking.createProperty({
      zip: '', // use default TZ
    });
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      state: 'authorized',
      property: propertyDoc,
      trelloCardURL: '',
    });
    const jobDoc = firebase.createDocRef();
    const bid = mocking.createJob({
      job: jobDoc,
      state: 'approved',
      completedAt,
    });
    const trelloIntegration = mocking.createPropertyTrelloIntegration();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));
    sinon
      .stub(integrationsModel, 'firestoreFindTrello')
      .resolves(firebase.createDocSnapshot('trello', { member: uuid() }));
    sinon
      .stub(integrationsModel, 'firestoreFindTrelloProperty')
      .resolves(
        firebase.createDocSnapshot(`trello-${PROPERTY_ID}`, trelloIntegration)
      );
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(stubs.wrapSnapshot([bid]));
    const publish = sinon
      .stub(trelloService, 'publishListCard')
      .resolves({ id: uuid(), shortUrl: 'test.co/123' });

    // Execute
    await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500);

    // Assertions
    const result = publish.firstCall || { args: [] };
    const jobCardConfig = result.args[3] || { due: '' };
    const actual = jobCardConfig.due;
    expect(actual).to.equal(expected);
  });

  it('should submit the expected Trello card description', async () => {
    const property = mocking.createProperty();
    const propertyDoc = firebase.createDocRef();
    const job = mocking.createJob({
      property: propertyDoc,
      trelloCardURL: '',
    });
    const cardId = uuid();
    const cardUrl = 'test.com/image.png';
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = {
      id: cardId,
      shortUrl: cardUrl,
    };
    const expected = `Job
Property: test property
Job: test job

Sparkle job: ${CLIENT_API_DOMAIN.replace('{{propertyId}}', PROPERTY_ID).replace(
      '{{jobId}}',
      JOB_ID
    )}`;

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(PROPERTY_ID, property));
    sinon
      .stub(jobsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(JOB_ID, job));

    sinon
      .stub(integrationsModel, 'firestoreFindTrello')
      .resolves(firebase.createDocSnapshot('trello', { member: uuid() }));
    sinon
      .stub(integrationsModel, 'firestoreFindTrelloProperty')
      .resolves(
        firebase.createDocSnapshot(`trello-${PROPERTY_ID}`, trelloIntegration)
      );
    sinon
      .stub(jobsModel, 'findAssociatedBids')
      .resolves(stubs.wrapSnapshot([]));
    sinon.stub(systemModel, 'firestoreUpsertPropertyTrello').resolves();
    sinon.stub(jobsModel, 'updateRecord').resolves();

    let actual = '';
    sinon
      .stub(trelloService, 'publishListCard')
      .callsFake((listId, authToken, apiKey, payload) => {
        actual = payload.desc;
        return Promise.resolve(trelloResponse);
      });

    // Execute
    await request(createApp())
      .post(`/t/${PROPERTY_ID}/${JOB_ID}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId/:jobId',
    stubAuth,
    stubTrelloReq,
    handler(
      {
        collection: () => {},
        batch: () => ({ commit: () => Promise.resolve() }),
      },
      CLIENT_API_DOMAIN,
      DEFAULT_ZIP
    )
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
