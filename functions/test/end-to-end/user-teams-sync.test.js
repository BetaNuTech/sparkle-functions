const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('User Teams Sync', () => {
  afterEach(() => cleanDb(db));

  it('should add all missing teams and property associations to all users', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const userId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();
    const expectedPayload = {
      [team1Id]: { [property1Id]: true, [property2Id]: true },
      [team2Id]: { [property3Id]: true, [property4Id]: true },
    };
    const pubSubMessage = { json: { id: userId } };

    // Setup database
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: 'Condo', team: team1Id }); // Add property and team
    await db
      .ref(`/properties/${property2Id}`)
      .set({ name: 'Tree House', team: team1Id }); // Add property 2 and team
    await db
      .ref(`/properties/${property3Id}`)
      .set({ name: 'Mansion', team: team2Id }); // Add property 3 and team 2
    await db
      .ref(`/properties/${property4Id}`)
      .set({ name: 'Apartment', team: team2Id }); // Add property 4 and team 2

    await db
      .ref(`/users/${userId}`)
      .set({
        firstName: 'Fred',
        teams: {
          [team1Id]: { [property1Id]: true },
          [team2Id]: { [property3Id]: true },
        },
      }); // Add user

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const actual = await db.ref(`/users/${userId}/teams`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(
      expectedPayload,
      `synced /users/${userId}/teams by adding missing`
    );
  });

  it('should remove all invalid teams and property associates from all users', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();
    const expectedPayload = {
      [team1Id]: { [property1Id]: true },
    };
    const pubSubMessage = { json: { id: user1Id } };

    // Setup database
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: 'Condo', team: team1Id }); // Add property and team

    await db.ref(`/users/${user1Id}`).set({
      firstName: 'Fred',
      teams: {
        [team1Id]: { [property1Id]: true, [property2Id]: true },
        [team2Id]: { [property3Id]: true, [property4Id]: true },
      },
    }); // Add user
    await db.ref(`/users/${user2Id}`).set({ firstName: 'no-teams' }); // Regression check for user /wo teams

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const actual = await db.ref(`/users/${user1Id}/teams`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(
      expectedPayload,
      `synced /users/${user1Id}/teams by removing invalid`
    );
  });

  it('should remove all invalid team/properties associations when all properties have no team associations', async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const pubSubMessage = { json: { id: userId } };
    const expected = false;

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: 'Condo' }); // Add property /wo team
    await db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team /wo property
    await db.ref(`/users/${userId}`).set({
      firstName: 'Fred',
      teams: {
        [teamId]: { [propertyId]: true }, // outdated team association
      },
    });

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const actualSnap = await db.ref(`/users/${userId}/teams`).once('value');
    const actual = actualSnap.exists();

    // Assertions
    expect(actual).to.equal(
      expected,
      `synced removed property from /users/${userId}/teams by removing invalid`
    );
  });
});
