const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const handler = require('../../../teams/api/delete');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const mocking = require('../../../test-helpers/mocking');
const { db } = require('../../setup');
const propertiesModel = require('../../../models/properties');
const teamsModel = require('../../../models/teams');
const usersModel = require('../../../models/users');

describe('Teams | API | DELETE', () => {
  afterEach(() => cleanDb(db));

  it("should disassociate all team's associated properties", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();
    const property1Data = mocking.createProperty({ team: team1Id });
    const property2Data = mocking.createProperty({ team: team1Id });
    const team1Data = mocking.createTeam({
      properties: [property1Id, property2Id],
    });
    const team2Data = mocking.createTeam({
      properties: [property3Id, property4Id],
    });

    // Setup database
    await propertiesModel.upsertRecord(db, property1Id, property1Data);
    await propertiesModel.upsertRecord(db, property2Id, property2Data);
    await teamsModel.upsertRecord(db, team1Id, team1Data); // Add team
    await teamsModel.upsertRecord(db, team2Id, team2Data); // Add team

    // Execute
    const app = createApp();
    await request(app)
      .delete(`/t/${team1Id}`)
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    // Test result
    const team1Snap = await teamsModel.findRecord(db, team1Id);
    const team2Snap = await teamsModel.findRecord(db, team2Id);
    const prop1Snap = await propertiesModel.findRecord(db, property1Id);
    const prop2Snap = await propertiesModel.findRecord(db, property2Id);
    delete property1Data.team;
    delete property2Data.team;

    // Assertions
    [
      {
        actual: team1Snap.data() || {},
        expected: {},
        msg: 'team 1 was removed',
      },
      {
        actual: team2Snap.data() || null,
        expected: {
          name: team2Data.name,
          properties: {
            [property3Id]: true,
            [property4Id]: true,
          },
        },
        msg: 'team 2 is unchanged',
      },
      {
        actual: prop1Snap.data() || null,
        expected: property1Data,
        msg: 'removed property 1 team association',
      },
      {
        actual: prop2Snap.data() || null,
        expected: property2Data,
        msg: 'removed property 2 team association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should disassociate all team's users", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const team1Data = mocking.createTeam({ name: 'Team 1' });
    const team2Data = mocking.createTeam({ name: 'Team 2' });
    const user1Data = {
      firstName: 'User 1',
      teams: { [team1Id]: { [property2Id]: true } },
    };
    const user2Data = {
      firstName: 'User 2',
      teams: {
        [team1Id]: { [property2Id]: true },
        [team2Id]: { [property1Id]: true },
      },
    };

    // Setup database
    await teamsModel.upsertRecord(db, team1Id, team1Data); // Add team
    await teamsModel.upsertRecord(db, team2Id, team2Data); // Add team
    await usersModel.upsertRecord(db, user1Id, user1Data); // Add user 1 with teamID
    await usersModel.upsertRecord(db, user2Id, user2Data); // Add user 2 with teamID

    // Execute
    const app = createApp();
    await request(app)
      .delete(`/t/${team1Id}`)
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    // Test result
    const team2Snap = await teamsModel.findRecord(db, team2Id);
    const user1Snap = await usersModel.findRecord(db, user1Id);
    const user2Snap = await usersModel.findRecord(db, user2Id);

    // Assertions
    [
      {
        actual: team2Snap.data() || null,
        expected: { name: team2Data.name },
        msg: 'team 2 unchanged',
      },
      {
        actual: user1Snap.data() || null,
        expected: { firstName: user1Data.firstName, teams: {} }, // Allow empty teams
        msg: 'removed user 1 team association',
      },
      {
        actual: user2Snap.data() || null,
        expected: {
          firstName: user2Data.firstName,
          teams: { [team2Id]: { [property1Id]: true } },
        },
        msg: 'removed user 2 team association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.delete('/t/:teamId', bodyParser.json(), handler(db));
  return app;
}
