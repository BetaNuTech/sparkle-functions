const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const usersModel = require('../../../models/users');
const properiesModel = require('../../../models/properties');
const teamsModel = require('../../../models/teams');
const handler = require('../../../users/api/patch');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs: db, auth } = require('../../setup');

describe('Users | API | PATCH', () => {
  afterEach(() => {
    sinon.restore();
    return cleanDb(null, db);
  });

  it('should allow admin to update a target user permission level', async () => {
    const userId = uuid();
    const team1Id = uuid();
    const team2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const team1 = mocking.createTeam();
    const team2 = mocking.createTeam();
    const property1 = mocking.createProperty();
    const property2 = mocking.createProperty();
    const property3 = mocking.createProperty({ team: team2Id }); // has team
    const user = mocking.createUser({
      teams: { [team1Id]: true },
      properties: { [property1Id]: true },
    });

    // Setup database
    await usersModel.createRecord(db, userId, user);
    await teamsModel.createRecord(db, team1Id, team1);
    await teamsModel.createRecord(db, team2Id, team2);
    await properiesModel.createRecord(db, property1Id, property1);
    await properiesModel.createRecord(db, property2Id, property2);
    await properiesModel.createRecord(db, property3Id, property3);

    // Stub auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({ admin: true });
    sinon.stub(usersModel, 'getAuthUser').resolves({});

    // Execute
    const app = createApp({ admin: true });
    await request(app)
      .patch(`/t/${userId}`)
      .send({
        firstName: 'Testorator9000',
        teams: { [team1Id]: false, [team2Id]: true },
        properties: { [property1Id]: false, [property2Id]: true },
      })
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Results
    const snapshot = await usersModel.findRecord(db, userId);
    const result = snapshot.data() || {};

    // Assertions
    const tests = [
      {
        expected: 'Testorator9000',
        actual: result.firstName || '',
        message: 'update first name',
      },
      {
        expected: undefined,
        actual: (result.properties || {})[property1Id],
        message: 'removed deleted property association',
      },
      {
        expected: true,
        actual: (result.properties || {})[property2Id],
        message: 'added new property association',
      },
      {
        expected: undefined,
        actual: (result.teams || {})[team1Id],
        message: 'removed deleted team association',
      },
      {
        expected: true,
        actual: Boolean(((result.teams || {})[team2Id] || {})[property3Id]),
        message: 'add team with property association',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, actual, message } = tests[i];
      expect(actual).to.equal(expected, message);
    }
  });

  it('should allows non-admins to update their own user profile', async () => {
    const userId = uuid();
    const user = mocking.createUser();
    const payload = {
      firstName: 'TestorAtor4000',
      lastName: 'ItsVeryrandom',
      pushOptOut: true,
    };

    // Setup database
    await usersModel.createRecord(db, userId, user);

    // Stub auth requests
    sinon.stub(usersModel, 'getCustomClaims').resolves({ admin: false });
    sinon.stub(usersModel, 'getAuthUser').resolves({});

    // Execute
    const app = createApp({ id: userId, admin: false });
    await request(app)
      .patch(`/t/${userId}`)
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(200);

    // Get Results
    const snapshot = await usersModel.findRecord(db, userId);
    const result = snapshot.data() || {};

    // Assertions
    const tests = [
      {
        expected: payload.firstName,
        actual: result.firstName || '',
        message: 'updated first name',
      },
      {
        expected: payload.lastName,
        actual: result.lastName || '',
        message: 'updated last name',
      },
      {
        expected: payload.pushOptOut,
        actual: result.pushOptOut,
        message: 'updated push opt out',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, actual, message } = tests[i];
      expect(actual).to.equal(expected, message);
    }
  });
});

function createApp(user = {}) {
  const app = express();
  app.patch('/t/:userId', bodyParser.json(), stubAuth(user), handler(db, auth));
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: uuid() }, user);
    next();
  };
}
