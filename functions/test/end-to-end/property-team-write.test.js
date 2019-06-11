const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions, pubsub } = require('./setup');

describe('Teams Write', () => {
  afterEach(() => cleanDb(db));

  it('should queue update to each user in a team, when that team it is added to a property', async () => {
    const teamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const expected = [user2Id, user1Id];
    const actual = [];
    const unsubscribe = pubsub.subscribe('user-teams-sync', data =>
      actual.push(Buffer.from(data, 'base64').toString())
    );

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: 'test' }); // Add property
    await db.ref(`/users/${user1Id}`).set({
      teams: { [teamId]: { [property2Id]: true } },
    }); // Add user 1 with teamID
    await db.ref(`/users/${user2Id}`).set({
      teams: { [teamId]: { [property2Id]: true } },
    }); // Add user 2 with teamID
    await db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

    const propertyBeforeSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get before team added
    await db.ref(`/properties/${property1Id}/team`).set(teamId); // add team
    const propertyAfterSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get after team added

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
    await wrapped(changeSnap, { params: { propertyId: property1Id } });

    // Assertions
    expect(actual).to.deep.equal(expected);

    // Cleanup
    unsubscribe();
  });

  it('should queue update to each user in a team, when that team it is removed from a property', async () => {
    const teamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const propertyId = uuid();
    const expected = [user2Id, user1Id];
    const actual = [];
    const unsubscribe = pubsub.subscribe('user-teams-sync', data =>
      actual.push(Buffer.from(data, 'base64').toString())
    );

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({
      name: 'test',
      team: teamId,
    });
    await db.ref(`/users/${user1Id}`).set({
      teams: { [teamId]: { [propertyId]: true } },
    }); // Add user 1 with teamID
    await db.ref(`/users/${user2Id}`).set({
      teams: { [teamId]: { [propertyId]: true } },
    }); // Add user 2 with teamID
    await db
      .ref(`/teams/${teamId}`)
      .set({ properties: { [propertyId]: true } }); // Add team

    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}/team`)
      .once('value'); // Get before team added
    await db.ref(`/properties/${propertyId}/team`).remove(); // remove team
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}/team`)
      .once('value'); // Get after team added

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Assertions
    expect(actual).to.deep.equal(expected);

    // Cleanup
    unsubscribe();
  });

  it('should associate a property with the team it was added to', async () => {
    const teamId = uuid();
    const user1Id = uuid();
    const user2Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const expected = { [property1Id]: true };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: 'test' }); // Add property
    await db.ref(`/users/${user1Id}`).set({
      teams: { [teamId]: { [property2Id]: true } },
    }); // Add user 1 with teamID
    await db.ref(`/users/${user2Id}`).set({ firstName: 'no-teams' }); // regression check
    await db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

    const propertyBeforeSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get before team added
    await db.ref(`/properties/${property1Id}/team`).set(teamId); // add team
    const propertyAfterSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get after team added

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
    await wrapped(changeSnap, { params: { propertyId: property1Id } });

    // Test result
    const actualSnap = await db
      .ref(`/teams/${teamId}/properties`)
      .once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.deep.equal(
      expected,
      `added ${property1Id} to /teams/${teamId}/properties`
    );
  });

  it('should dissociate a property from the team it was removed from', async () => {
    const teamId = uuid();
    const team2Id = uuid();
    const user1Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();

    // Setup database
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: 'test', team: teamId }); // Add property
    await db.ref(`/users/${user1Id}`).set({
      teams: { [teamId]: { [property2Id]: true } },
    }); // Add user 1 with teamID
    await db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

    const propertyBeforeSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get before team
    await db.ref(`/properties/${property1Id}/team`).set(team2Id); // set to a new team
    const propertyAfterSnap = await db
      .ref(`/properties/${property1Id}/team`)
      .once('value'); // Get after team added

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
    await wrapped(changeSnap, { params: { propertyId: property1Id } });

    // Test result
    const actual = await db
      .ref(`/teams/${teamId}/properties/${property1Id}`)
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(
      false,
      `removed /teams/${teamId}/properties/${property1Id}`
    );
  });
});
