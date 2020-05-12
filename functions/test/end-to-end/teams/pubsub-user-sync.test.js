const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const usersModel = require('../../../models/users');
const teamsModel = require('../../../models/teams');
const propertiesModel = require('../../../models/properties');
const { fs, db, test, cloudFunctions } = require('../../setup');

describe('Teams | Pubsub | User Sync', () => {
  afterEach(() => cleanDb(db, fs));

  it('should add all missing teams and property associations to all users', async () => {
    const team1Id = uuid();
    const team2Id = uuid();
    const userId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const property3Id = uuid();
    const property4Id = uuid();
    const userData = {
      firstName: 'Fred',
      teams: {
        [team1Id]: { [property1Id]: true },
        [team2Id]: { [property3Id]: true },
      },
    };
    const final = {
      [team1Id]: { [property1Id]: true, [property2Id]: true },
      [team2Id]: { [property3Id]: true, [property4Id]: true },
    };
    const pubSubMessage = { data: Buffer.from(userId) };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, {
      name: 'Condo',
      team: team1Id,
    }); // Add property and team
    await propertiesModel.realtimeUpsertRecord(db, property2Id, {
      name: 'Tree House',
      team: team1Id,
    }); // Add property 2 and team
    await propertiesModel.realtimeUpsertRecord(db, property3Id, {
      name: 'Mansion',
      team: team2Id,
    }); // Add property 3 and team 2
    await propertiesModel.realtimeUpsertRecord(db, property4Id, {
      name: 'Apartment',
      team: team2Id,
    }); // Add property 4 and team 2
    await usersModel.realtimeUpsertRecord(db, userId, userData); // Add user

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const resultRt = await usersModel.getUser(db, userId);
    const resultFs = await usersModel.firestoreFindRecord(fs, userId);
    const actualRt = (resultRt.val() || {}).teams || null;
    const actualFs = resultFs.data() || null;

    // Assertions
    [
      {
        actual: actualRt,
        expected: final,
        msg: 'added realtime db user associations',
      },
      {
        actual: actualFs,
        expected: { ...userData, teams: final },
        msg: 'created new firestore record with latest user associations',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it('should remove all invalid team property associations from user', async () => {
    const teamId = uuid();
    const user1Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const final = {
      [teamId]: { [property1Id]: true },
    };
    const pubSubMessage = { data: Buffer.from(user1Id) };
    const userData = {
      firstName: 'test',
      teams: {
        [teamId]: {
          [property1Id]: true, // valid
          [property2Id]: true, // invalid
        },
      },
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, property1Id, {
      team: teamId,
    }); // Add property /w team
    await usersModel.realtimeUpsertRecord(db, user1Id, userData);
    await usersModel.firestoreUpsertRecord(fs, user1Id, userData);

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const resultRt = await usersModel.getUser(db, user1Id);
    const resultFs = await usersModel.firestoreFindRecord(fs, user1Id);
    const actualRt = (resultRt.val() || {}).teams || null;
    const actualFs = resultFs.data() || null;

    // Assertions
    [
      {
        actual: actualRt,
        expected: final,
        msg: `removed property "${property2Id}" from realtime user's teams`,
      },
      {
        actual: actualFs,
        expected: { ...userData, teams: final },
        msg: 'updated existing firestore user by removing property from teams',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should remove all invalid properties from a users' teams, keeping their team membership intact", async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const pubSubMessage = { data: Buffer.from(userId) };
    const final = {
      [teamId]: true,
    };
    const userData = {
      teams: {
        [teamId]: { [propertyId]: true }, // outdated team association
      },
    };

    // Setup database
    // NOTE: additionlly tests important edge case for all
    // property/team associations to be removed and user
    // to still get updated
    await propertiesModel.realtimeUpsertRecord(db, propertyId, {
      name: 'Condo',
    }); // Add property /wo team
    await teamsModel.realtimeUpsertRecord(db, teamId, { name: 'Team1' }); // Add team /wo property
    await usersModel.realtimeUpsertRecord(db, userId, userData);
    await usersModel.firestoreUpsertRecord(fs, userId, userData);

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const resultRt = await usersModel.getUser(db, userId);
    const resultFs = await usersModel.firestoreFindRecord(fs, userId);
    const actualRt = (resultRt.val() || {}).teams || null;
    const actualFs = resultFs.data() || null;

    // Assertions
    [
      {
        actual: actualRt,
        expected: final,
        msg: `removed property from user's teams assocations`,
      },
      {
        actual: actualFs,
        expected: { ...userData, teams: final },
        msg:
          'updated existing firestore user by removing property users from teams',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });

  it("should add property association to user of team that just associated its' first property", async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const pubSubMessage = { data: Buffer.from(userId) };
    const final = {
      [teamId]: {
        [propertyId]: true,
      },
    };
    const userData = {
      teams: {
        [teamId]: true, // add user to team /wo properties
      },
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, {
      team: teamId,
    }); // Add property /w team
    await teamsModel.realtimeUpsertRecord(db, teamId, {}); // Add team /wo property
    await usersModel.realtimeUpsertRecord(db, userId, userData);

    // Execute
    await test.wrap(cloudFunctions.userTeamsSync)(pubSubMessage);

    // Test result
    const resultRt = await usersModel.getUser(db, userId);
    const resultFs = await usersModel.firestoreFindRecord(fs, userId);
    const actualRt = (resultRt.val() || {}).teams || null;
    const actualFs = resultFs.data() || null;

    // Assertions
    [
      {
        actual: actualRt,
        expected: final,
        msg: 'user team membership contains first property association',
      },
      {
        actual: actualFs,
        expected: { ...userData, teams: final },
        msg: 'updated existing firestore user with teams property association',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.deep.equal(expected, msg);
    });
  });
});
