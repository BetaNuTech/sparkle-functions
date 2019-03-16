const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../push-messages/on-create-request-handler');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, auth, deletePDFInspection } = require('./setup');

describe('Create Send Messages', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without authorization', async function() {
    // Execute & Get Result
    const app = createApp(db, {}, auth); // auth required when given
    return request(app)
      .post('/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });
});
