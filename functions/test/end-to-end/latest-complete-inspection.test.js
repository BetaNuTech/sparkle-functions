const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../inspections/get-latest-completed');
const { cleanDb } = require('../../test-helpers/firebase');
const { db } = require('./setup');

describe('Latest Complete Inspection', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without cobalt code', function(done) {
    // Execute & Get Result
    const app = createApp(db);

    request(app)
      .get('/')
      .expect(400)
      .end((err, res) => {
        expect(res.text.toLowerCase()).to.have.string('missing parameters');
        done();
      });
  });

  it('should reject request without property matching cobalt code', function(done) {
    // Execute & Get Result
    const app = createApp(db);
    request(app)
      .get('/?cobalt_code=1')
      .expect(404)
      .end((err, res) => {
        expect(res.text.toLowerCase()).to.have.string('not found');
        done();
      });
  });
});
