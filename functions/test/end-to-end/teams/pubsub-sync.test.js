const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const teamsModel = require('../../../models/teams');
const propertiesModel = require('../../../models/properties');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Teams | Pubsub | Sync', () => {
  afterEach(() => cleanDb(db, fs));

  it('should add all missing property associations to all teams', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const team3Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const finalTeam1 = { [property1Id]: true, [property2Id]: true };
    const finalTeam2 = { [property3Id]: true };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, {
      name: 'Test',
      team: team1Id,
    }); // Add property and team
    await propertiesModel.realtimeUpsertRecord(db, property2Id, {
      name: 'Test 2',
      team: team1Id,
    }); // Add property 2 and team
    await propertiesModel.realtimeUpsertRecord(db, property3Id, {
      name: 'Test 3',
      team: team2Id,
    }); // Add property 3 to team 2

    await teamsModel.realtimeUpsertRecord(db, team1Id, { name: 'Team1' }); // Add team
    await teamsModel.realtimeUpsertRecord(db, team2Id, { name: 'Team2' }); // Add team
    await teamsModel.realtimeUpsertRecord(db, team3Id, { name: 'Team3' }); // Regression check for team /wo properties

    // Execute
    await test.wrap(cloudFunctions.teamsSync)();

    // Test result
    const team1Rt = await teamsModel.realtimeFindRecord(db, team1Id);
    const team2Rt = await teamsModel.realtimeFindRecord(db, team2Id);

    // Assertions
    [
      {
        actual: (team1Rt.val() || {}).properties || null,
        expected: finalTeam1,
        msg: "synced team one's properties",
      },
      {
        actual: (team2Rt.val() || {}).properties || null,
        expected: finalTeam2,
        msg: "synced team two's missing properties",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it('should remove all invalid property associates to all teams', async () => {
    const team1Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const expectedPayload = { [property1Id]: true };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, {
      name: 'Test',
      team: team1Id,
    }); // Add property and team
    await teamsModel.realtimeUpsertRecord(db, team1Id, {
      name: 'Team1',
      properties: { [property1Id]: true, [property2Id]: true },
    }); // Add team

    // Execute
    await test.wrap(cloudFunctions.teamsSync)();

    // Test result
    const resulRt = await teamsModel.realtimeFindRecord(db, team1Id);
    const actual = (resulRt.val() || {}).properties || null;

    // Assertions
    expect(actual).to.deep.equal(
      expectedPayload,
      'removed non-existent property from team'
    );
  });

  it('should remove all invalid team/properties associations when all properties have no team associations', async () => {
    const team1Id = uuid();
    const property1Id = uuid();
    const expected = false;

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, {
      name: 'Test',
    }); // Add property /wo team
    await teamsModel.realtimeUpsertRecord(db, team1Id, {
      name: 'Team1',
      properties: { [property1Id]: true },
    }); // Add team /w property

    // Execute
    await test.wrap(cloudFunctions.teamsSync)();

    // Test result
    const resulRt = await teamsModel.realtimeFindRecord(db, team1Id);
    const actual = Boolean((resulRt.val() || {}).properties || null);

    // Assertions
    expect(actual).to.equal(
      expected,
      'removed property from team no longer associated with it'
    );
  });
});
