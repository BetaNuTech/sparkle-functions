const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const teamsModel = require('../../../models/teams');
const handler = require('../../../teams/api/patch');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db } = require('../../setup');

describe('Teams | API | PATCH', () => {
  afterEach(() => cleanDb(null, db));

  it('should update an existing team', async () => {
    const expected = 'Updated Team';
    const teamId = uuid();
    const team = mocking.createTeam({ name: 'Original Team' });

    // Setup database
    await teamsModel.createRecord(db, teamId, team);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${teamId}`)
      .send({ name: expected })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const teamSnap = await teamsModel.findRecord(db, teamId);
    const result = teamSnap.data() || {};
    const actual = result.name || '';

    // Assertion
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:teamId', bodyParser.json(), handler(db));
  return app;
}
