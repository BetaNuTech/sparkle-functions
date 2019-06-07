const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Teams Sync', () => {
  afterEach(() => cleanDb(db));

  it('should add all missing property assocaitions to all teams', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const expectedPayloadTeam1 = { [property1Id]: true, [property2Id]: true }
    const expectedPayloadTeam2 = { [property3Id]: true }

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: 'Condo', team: team1Id }); // Add property and team 
    await db.ref(`/properties/${property2Id}`).set({ name: 'Tree House', team: team1Id }); // Add property 2 and team
    await db.ref(`/properties/${property3Id}`).set({ name: 'Mansion', team: team2Id }); // Add property 3 to team 2

    await db.ref(`/teams/${team1Id}`).set({ name: 'Team1' }); // Add team
    await db.ref(`/teams/${team2Id}`).set({ name: 'Team2' }); // Add team

    // Execute
    await test.wrap(cloudFunctions.teamsSync)();

    // Test result
    const actualTeam1 = await db.ref(`/teams/${team1Id}/properties`).once('value');
    const actualTeam2 = await db.ref(`/teams/${team2Id}/properties`).once('value');

    // Assertions
    expect(actualTeam1.val()).to.deep.equal(expectedPayloadTeam1, `synced /teams/${team1Id}/properties by adding missing`);
    expect(actualTeam2.val()).to.deep.equal(expectedPayloadTeam2, `synced /teams/${team2Id}/properties by adding missing`);
  });

  it('should remove all invalid property associates to all teams', async () => {
    const team1Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const expectedPayload = { [property1Id]: true }

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: 'Condo', team: team1Id }); // Add property and team

    await db.ref(`/teams/${team1Id}`).set({ name: 'Team1', properties: { [property1Id]: true, [property2Id]: true } }); // Add team

    // Execute
    await test.wrap(cloudFunctions.teamsSync)();

    // Test result
    const actual = await db.ref(`/teams/${team1Id}/properties`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expectedPayload, `synced /teams/${team1Id}/properties by removing invalid`);
  });
});
