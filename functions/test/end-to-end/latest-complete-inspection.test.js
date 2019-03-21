const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../inspections/get-latest-completed');
const { cleanDb } = require('../../test-helpers/firebase');
const { db } = require('./setup');

describe('Latest Complete Inspection', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without cobalt code', async function() {
    // Execute & Get Result
    const app = createApp(db);
    return request(app)
      .get('/')
      .expect(400);
  });
});
