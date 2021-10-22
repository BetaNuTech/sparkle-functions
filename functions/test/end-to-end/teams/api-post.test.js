const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const teamsModel = require('../../../models/teams');
const handler = require('../../../teams/api/post');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Teams | API | POST', () => {
  afterEach(() => cleanDb(null, db));

  it('should create a new team', async () => {
    const expected = 'New Team';

    // Execute
    const app = createApp();
    const res = await request(app)
      .post('/t')
      .send({ name: expected })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const body = res ? res.body : {};
    const teamDoc = body ? body.data : {};
    const teamId = teamDoc.id || 'na';
    const teamSnap = await teamsModel.findRecord(db, teamId);
    const result = teamSnap.data() || {};
    const actual = result.name;

    // Assertion
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t', bodyParser.json(), handler(db));
  return app;
}
