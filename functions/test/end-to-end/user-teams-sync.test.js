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
    const pubSubMessage = { data: Buffer.from(userId) };

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

    await db.ref(`/users/${userId}`).set({
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

  it('should remove all invalid team property associations from user', async () => {
    const teamId = uuid();
    const user1Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const expected = {
      [teamId]: { [property1Id]: true },
    };
    const pubSubMessage = { data: Buffer.from(user1Id) };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ team: teamId }); // Add property /w team

    await db.ref(`/users/${user1Id}`).set({
      teams: {
        [teamId]: {
          [property1Id]: true, // valid
          [property2Id]: true, // invalid
        },
      },
    });

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const resultSnap = await db.ref(`/users/${user1Id}/teams`).once('value');
    const actual = resultSnap.val();

    // Assertions
    expect(actual).to.deep.equal(
      expected,
      `removed property ${property2Id} from teams`
    );
  });

  it("should remove all invalid properties from a users' teams, keeping their team membership intact", async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const pubSubMessage = { data: Buffer.from(userId) };
    const expected = {
      [teamId]: true,
    };

    // Setup database
    // NOTE: additionlly tests important edge case for all
    // property/team associations to be removed and user
    // to still get updated
    await db.ref(`/properties/${propertyId}`).set({ name: 'Condo' }); // Add property /wo team
    await db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team /wo property
    await db.ref(`/users/${userId}`).set({
      teams: {
        [teamId]: { [propertyId]: true }, // outdated team association
      },
    });

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const actualSnap = await db.ref(`/users/${userId}/teams`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.deep.equal(
      expected,
      `synced removed property from /users/${userId}/teams by removing invalid`
    );
  });

  it("should add property association to user of team that just associated its' first property", async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const pubSubMessage = { data: Buffer.from(userId) };
    const expected = {
      [teamId]: {
        [propertyId]: true,
      },
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({}); // Add property /wo team
    await db.ref(`/teams/${teamId}`).set({}); // Add team /wo property
    await db.ref(`/users/${userId}`).set({
      teams: {
        [teamId]: true, // add user to team /wo properties
      },
    });
    await db.ref(`/properties/${propertyId}/team`).set(teamId); // Add property to team

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const actualSnap = await db.ref(`/users/${userId}/teams`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.deep.equal(
      expected,
      'users team membership contains first property association'
    );
  });
});
