const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../../setup');

describe('Teams | Delete Handler', () => {
  afterEach(() => cleanDb(db));

  it("should disassociate all team's associated properties", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();

    const expectedProperty1Payload = { name: 'Tree House' };
    const expectedProperty2Payload = { name: 'Mansion' };
    const expectedTeam2Payload = {
      name: 'Team2',
      properties: {
        [property3Id]: true,
        [property4Id]: true,
      },
    };

    // Setup database
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: 'Tree House', team: team1Id }); // Add property with team 1
    await db
      .ref(`/properties/${property2Id}`)
      .set({ name: 'Mansion', team: team1Id }); // Add property with team 1

    await db.ref(`/teams/${team1Id}`).set({
      name: 'Team1',
      properties: { [property1Id]: true, [property2Id]: true },
    }); // Add team
    await db.ref(`/teams/${team2Id}`).set({
      name: 'Team2',
      properties: { [property3Id]: true, [property4Id]: true },
    }); // Add team

    const teamSnap = await db.ref(`/teams/${team1Id}`).once('value'); // Get team snap before removal

    await db.ref(`/teams/${team1Id}`).remove(); // remove team

    // Execute
    const wrapped = test.wrap(cloudFunctions.teamDelete);
    await wrapped(teamSnap, { params: { teamId: team1Id } });

    // Test result
    const actualTeam1 = await db.ref(`/teams/${team1Id}`).once('value');
    const actualTeam2 = await db.ref(`/teams/${team2Id}`).once('value');
    const actualProperty1 = await db
      .ref(`/properties/${property1Id}`)
      .once('value');
    const actualProperty2 = await db
      .ref(`/properties/${property2Id}`)
      .once('value');

    // Assertions
    expect(actualTeam1.exists()).to.equal(false, `removed /teams/${team1Id}`);
    expect(actualTeam2.val()).to.deep.equal(
      expectedTeam2Payload,
      `has not changed /teams/${team2Id}`
    );
    expect(actualProperty1.val()).to.deep.equal(
      expectedProperty1Payload,
      `removed /properties/${property1Id}/team`
    );
    expect(actualProperty2.val()).to.deep.equal(
      expectedProperty2Payload,
      `removed /properties/${property2Id}/team`
    );
  });

  it("should disassociate all team's users", async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();

    const expectedTeam2Payload = {
      name: 'Team2',
    };

    const expectedUser1Payload = {
      firstName: 'Fred',
      lastName: 'Flintstone',
    };

    const expectedUser2Payload = {
      firstName: 'Barney',
      lastName: 'Rubble',
      teams: {
        [team2Id]: { [property1Id]: true },
      },
    };

    // Setup database
    await db.ref(`/teams/${team1Id}`).set({ name: 'Team1' }); // Add team
    await db.ref(`/teams/${team2Id}`).set({ name: 'Team2' }); // Add team
    await db.ref(`/users/${user1Id}`).set({
      firstName: 'Fred',
      lastName: 'Flintstone',
      teams: { [team1Id]: { [property2Id]: true } },
    }); // Add user 1 with teamID

    await db.ref(`/users/${user2Id}`).set({
      firstName: 'Barney',
      lastName: 'Rubble',
      teams: {
        [team1Id]: { [property2Id]: true },
        [team2Id]: { [property1Id]: true },
      },
    }); // Add user 2 with teamID

    const teamSnap = await db.ref(`/teams/${team1Id}`).once('value'); // Get team snap before removal

    await db.ref(`/teams/${team1Id}`).remove(); // remove team

    // Execute
    const wrapped = test.wrap(cloudFunctions.teamDelete);
    await wrapped(teamSnap, { params: { teamId: team1Id } });

    // Test result
    const actualTeam1 = await db.ref(`/teams/${team1Id}`).once('value');
    const actualTeam2 = await db.ref(`/teams/${team2Id}`).once('value');
    const actualUser1 = await db.ref(`/users/${user1Id}`).once('value');
    const actualUser2 = await db.ref(`/users/${user2Id}`).once('value');

    // Assertions
    expect(actualTeam1.exists()).to.equal(false, `removed /teams/${team1Id}`);
    expect(actualTeam2.val()).to.deep.equal(
      expectedTeam2Payload,
      `has not changed /teams/${team2Id}`
    );
    expect(actualUser1.val()).to.deep.equal(
      expectedUser1Payload,
      `removed /users/${user1Id}/teams/${team1Id}`
    );
    expect(actualUser2.val()).to.deep.equal(
      expectedUser2Payload,
      `removed /users/${user2Id}/teams/${team1Id}`
    );
  });
});
