const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Teams Write', () => {
  afterEach(() => cleanDb(db));

  it('should associate a property with all users of a team when a team is added to a property', () =>
    co(function*() {
      const teamId = uuid();
      const user1Id = uuid();
      const user2Id = uuid();
      const property1Id = uuid();
      const property2Id = uuid();
      const expectedPayload = {
        [teamId]: { [property1Id]: true, [property2Id]: true },
      };

      // Setup database
      yield db.ref(`/properties/${property1Id}`).set({ name: 'test' }); // Add property
      yield db
        .ref(`/users/${user1Id}`)
        .set({
          firstName: 'Fred',
          lastName: 'Flintstone',
          teams: { [teamId]: { [property2Id]: true } },
        }); // Add user 1 with teamID
      yield db
        .ref(`/users/${user2Id}`)
        .set({
          firstName: 'Barney',
          lastName: 'Rubble',
          teams: { [teamId]: { [property2Id]: true } },
        }); // Add user 2 with teamID
      yield db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

      const propertyBeforeSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get before team added
      yield db.ref(`/properties/${property1Id}/team`).set(teamId); // add team
      const propertyAfterSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get after team added

      // Execute
      const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
      const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
      yield wrapped(changeSnap, { params: { propertyId: property1Id } });

      // Test result
      const actualUser1 = yield db.ref(`/users/${user1Id}/teams`).once('value');
      const actualUser2 = yield db.ref(`/users/${user2Id}/teams`).once('value');

      // Assertions
      expect(actualUser1.val()).to.deep.equal(
        expectedPayload,
        `added /users/${user1Id}/teams/${teamId}/${property1Id}`
      );
      expect(actualUser2.val()).to.deep.equal(
        expectedPayload,
        `added /users/${user2Id}/teams/${teamId}/${property1Id}`
      );
    }));

  it('should associate a property with the team it was added to', () =>
    co(function*() {
      const teamId = uuid();
      const userId = uuid();
      const property1Id = uuid();
      const property2Id = uuid();
      const expectedPayload = { [property1Id]: true };

      // Setup database
      yield db.ref(`/properties/${property1Id}`).set({ name: 'test' }); // Add property
      yield db
        .ref(`/users/${userId}`)
        .set({
          firstName: 'Fred',
          lastName: 'Flintstone',
          teams: { [teamId]: { [property2Id]: true } },
        }); // Add user 1 with teamID
      yield db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

      const propertyBeforeSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get before team added
      yield db.ref(`/properties/${property1Id}/team`).set(teamId); // add team
      const propertyAfterSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get after team added

      // Execute
      const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
      const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
      yield wrapped(changeSnap, { params: { propertyId: property1Id } });

      // Test result
      const actual = yield db.ref(`/teams/${teamId}/properties`).once('value');

      // Assertions
      expect(actual.val()).to.deep.equal(
        expectedPayload,
        `added /teams/${teamId}/properties`
      );
    }));

  it('should dissociate a property from the team it was removed from', () =>
    co(function*() {
      const teamId = uuid();
      const team2Id = uuid();
      const userId = uuid();
      const property1Id = uuid();
      const property2Id = uuid();

      // Setup database
      yield db
        .ref(`/properties/${property1Id}`)
        .set({ name: 'test', team: teamId }); // Add property
      yield db
        .ref(`/users/${userId}`)
        .set({
          firstName: 'Fred',
          lastName: 'Flintstone',
          teams: { [teamId]: { [property2Id]: true } },
        }); // Add user 1 with teamID
      yield db.ref(`/teams/${teamId}`).set({ name: 'Team1' }); // Add team

      const propertyBeforeSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get before team
      yield db.ref(`/properties/${property1Id}/team`).set(team2Id); // set to a new team
      const propertyAfterSnap = yield db
        .ref(`/properties/${property1Id}`)
        .once('value'); // Get after team added

      // Execute
      const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
      const wrapped = test.wrap(cloudFunctions.propertyTeamWrite);
      yield wrapped(changeSnap, { params: { propertyId: property1Id } });

      // Test result
      const actual = yield db
        .ref(`/teams/${teamId}/properties/${property1Id}`)
        .once('value');

      // Assertions
      expect(actual.exists()).to.equal(
        false,
        `removed /teams/${teamId}/properties/${property1Id}`
      );
    }));
});
