const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');
const propertiesModel = require('../../../models/properties');
const teamsModel = require('../../../models/teams');
const usersModel = require('../../../models/users');

describe('Teams | Delete Handler', () => {
  afterEach(() => cleanDb(db, fs));

  it("should disassociate all team's associated properties", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();
    const property1Data = {
      name: 'Prop 1',
      team: team1Id,
    };
    const property2Data = {
      name: 'Prop 2',
      team: team1Id,
    };
    const team1Data = {
      name: 'Team 1',
      properties: { [property1Id]: true, [property2Id]: true },
    };
    const team2Data = {
      name: 'Team 2',
      properties: { [property3Id]: true, [property4Id]: true },
    };
    const expectedProperty1Payload = { name: property1Data.name };
    const expectedProperty2Payload = { name: property2Data.name };
    const expectedTeam2Payload = {
      name: team2Data.name,
      properties: {
        [property3Id]: true,
        [property4Id]: true,
      },
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, property1Data); // Add property with team 1
    await propertiesModel.firestoreUpsertRecord(fs, property1Id, property1Data);
    await propertiesModel.realtimeUpsertRecord(db, property2Id, property2Data); // Add property with team 1
    await propertiesModel.firestoreUpsertRecord(fs, property2Id, property2Data);
    await teamsModel.realtimeUpsertRecord(db, team1Id, team1Data); // Add team
    await teamsModel.firestoreUpsertRecord(fs, team1Id, team1Data); // Add team
    await teamsModel.realtimeUpsertRecord(db, team2Id, team2Data); // Add team
    await teamsModel.firestoreUpsertRecord(fs, team2Id, team2Data); // Add team

    const teamSnap = await teamsModel.realtimeFindRecord(db, team1Id); // Get team snap before removal
    await teamsModel.realtimeRemoveRecord(db, team1Id); // remove team

    // Execute
    const wrapped = test.wrap(cloudFunctions.teamDelete);
    await wrapped(teamSnap, { params: { teamId: team1Id } });

    // Test result
    const team1Rt = await teamsModel.realtimeFindRecord(db, team1Id);
    const team1Fs = await teamsModel.firestoreFindRecord(fs, team1Id);
    const team2Rt = await teamsModel.realtimeFindRecord(db, team2Id);
    const team2Fs = await teamsModel.firestoreFindRecord(fs, team2Id);
    const prop1Rt = await propertiesModel.findRecord(db, property1Id);
    const prop1Fs = await propertiesModel.firestoreFindRecord(fs, property1Id);
    const prop2Rt = await propertiesModel.findRecord(db, property2Id);
    const prop2Fs = await propertiesModel.firestoreFindRecord(fs, property2Id);

    // Assertions
    [
      {
        actual: team1Rt.exists(),
        expected: false,
        msg: 'removed team 1',
      },
      {
        actual: team1Fs.exists,
        expected: false,
        msg: 'removed firestore team 1',
      },
      {
        actual: team2Rt.val(),
        expected: expectedTeam2Payload,
        msg: 'team 2 is unchanged',
      },
      {
        actual: team2Fs.data(),
        expected: expectedTeam2Payload,
        msg: 'firestore team 2 is unchanged',
      },
      {
        actual: prop1Rt.val(),
        expected: expectedProperty1Payload,
        msg: 'removed property 1 team association',
      },
      {
        actual: prop1Fs.data(),
        expected: expectedProperty1Payload,
        msg: 'removed firestore property 1 team association',
      },
      {
        actual: prop2Rt.val(),
        expected: expectedProperty2Payload,
        msg: 'removed property 2 team association',
      },
      {
        actual: prop2Fs.data(),
        expected: expectedProperty2Payload,
        msg: 'removed firestore property 2 team association',
      },
    ].forEach(({ actual, expected, msg }) => {
      if (typeof expected === 'boolean') {
        expect(actual).to.equal(expected, msg);
      } else {
        expect(actual).to.deep.equal(expected, msg);
      }
    });
  });

  it("should disassociate all team's users", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const team1Data = { name: 'Team 1' };
    const team2Data = { name: 'Team 2' };
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
    const expectedTeam2Payload = {
      name: team2Data.name,
    };
    const expectedUser1Payload = {
      firstName: user1Data.firstName,
    };
    const expectedUser2Payload = {
      firstName: user2Data.firstName,
      teams: {
        [team2Id]: { [property1Id]: true },
      },
    };

    // Setup database
    await teamsModel.realtimeUpsertRecord(db, team1Id, team1Data); // Add team
    await teamsModel.firestoreUpsertRecord(fs, team1Id, team1Data); // Add team
    await teamsModel.realtimeUpsertRecord(db, team2Id, team2Data); // Add team
    await teamsModel.firestoreUpsertRecord(fs, team2Id, team2Data); // Add team
    await usersModel.realtimeUpsertRecord(db, user1Id, user1Data); // Add user 1 with teamID
    await usersModel.firestoreUpsertRecord(fs, user1Id, user1Data); // Add user 1 with teamID
    await usersModel.realtimeUpsertRecord(db, user2Id, user2Data); // Add user 2 with teamID
    await usersModel.firestoreUpsertRecord(fs, user2Id, user2Data); // Add user 2 with teamID

    const teamSnap = await teamsModel.realtimeFindRecord(db, team1Id); // Get team snap before removal
    await teamsModel.realtimeRemoveRecord(db, team1Id); // remove team

    // Execute
    const wrapped = test.wrap(cloudFunctions.teamDelete);
    await wrapped(teamSnap, { params: { teamId: team1Id } });

    // Test result
    const team1Rt = await teamsModel.realtimeFindRecord(db, team1Id);
    const team1Fs = await teamsModel.firestoreFindRecord(fs, team1Id);
    const team2Rt = await teamsModel.realtimeFindRecord(db, team2Id);
    const team2Fs = await teamsModel.firestoreFindRecord(fs, team2Id);
    const user1Rt = await usersModel.getUser(db, user1Id);
    const user1Fs = await usersModel.firestoreFindRecord(fs, user1Id);
    const user2Rt = await usersModel.getUser(db, user2Id);
    const user2Fs = await usersModel.firestoreFindRecord(fs, user2Id);

    // Assertions
    [
      {
        actual: team1Rt.exists(),
        expected: false,
        msg: 'removed team 1',
      },
      {
        actual: team1Fs.exists,
        expected: false,
        msg: 'removed firestore team 1',
      },
      {
        actual: team2Rt.val(),
        expected: expectedTeam2Payload,
        msg: 'team 2 unchanged',
      },
      {
        actual: team2Fs.data(),
        expected: expectedTeam2Payload,
        msg: 'firestore team 2 unchanged',
      },
      {
        actual: user1Rt.val(),
        expected: expectedUser1Payload,
        msg: 'removed user 1 team association',
      },
      {
        actual: user1Fs.data(),
        expected: { ...expectedUser1Payload, teams: {} }, // Allow empty teams
        msg: 'removed firestore user 1 team association',
      },
      {
        actual: user2Rt.val(),
        expected: expectedUser2Payload,
        msg: 'removed user 2 team association',
      },
      {
        actual: user2Fs.data(),
        expected: expectedUser2Payload,
        msg: 'removed firestore user 2 team association',
      },
    ].forEach(({ actual, expected, msg }) => {
      if (typeof expected === 'boolean') {
        expect(actual).to.equal(expected, msg);
      } else {
        expect(actual).to.deep.equal(expected, msg);
      }
    });
  });

  it('should delete the firestore team', async () => {
    const teamId = uuid();
    const expected = false;
    const teamData = { name: 'Team 1' };

    await teamsModel.realtimeUpsertRecord(db, teamId, teamData); // Add team
    await teamsModel.firestoreUpsertRecord(fs, teamId, teamData); // Add team

    const teamSnap = await teamsModel.realtimeFindRecord(db, teamId); // Get team snap before removal
    await teamsModel.realtimeRemoveRecord(db, teamId); // remove team

    // Execute
    const wrapped = test.wrap(cloudFunctions.teamDelete);
    await wrapped(teamSnap, { params: { teamId } });

    // Results
    const teamDoc = await teamsModel.firestoreFindRecord(fs, teamId);
    const actual = teamDoc.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });
});
