const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const teamsModel = require('../../../models/teams');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Teams | Write', () => {
  afterEach(() => cleanDb(db, fs));

  it('should create a new firestore team', async () => {
    const teamId = uuid();
    const propertyId = uuid();
    const expected = {
      name: 'test 1',
      properties: {
        [propertyId]: true,
      },
    };

    // Setup Data
    const beforeSnap = await teamsModel.realtimeFindRecord(db, teamId);
    await teamsModel.realtimeUpsertRecord(db, teamId, expected); // Create
    const afterSnap = await teamsModel.realtimeFindRecord(db, teamId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.teamWrite);
    await wrapped(changeSnap, { params: { teamId } });

    // Test results
    const result = await teamsModel.firestoreFindRecord(fs, teamId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update an existing firestore team', async () => {
    const teamId = uuid();
    const propertyId = uuid();
    const beforeData = {
      name: 'test 1',
      properties: {
        [propertyId]: true,
      },
    };
    const afterData = {
      name: 'test 1',
      properties: null,
    };
    const expected = { ...afterData };
    delete expected.properties;

    // Setup Data
    await teamsModel.realtimeUpsertRecord(db, teamId, beforeData);
    const beforeSnap = await teamsModel.realtimeFindRecord(db, teamId);
    await teamsModel.realtimeUpsertRecord(db, teamId, afterData); // Update
    const afterSnap = await teamsModel.realtimeFindRecord(db, teamId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.teamWrite);
    await wrapped(changeSnap, { params: { teamId } });

    // Test results
    const result = await teamsModel.firestoreFindRecord(fs, teamId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should swap a property association in a firestore team', async () => {
    const teamId = uuid();
    const propertyId = uuid();
    const property2Id = uuid();
    const beforeData = {
      name: 'test 1',
      properties: {
        [propertyId]: true,
      },
    };
    const afterData = {
      name: 'test 1',
      properties: {
        [property2Id]: true,
      },
    };
    const expected = { ...afterData };

    // Setup Data
    await teamsModel.realtimeUpsertRecord(db, teamId, beforeData);
    const beforeSnap = await teamsModel.realtimeFindRecord(db, teamId);
    await teamsModel.realtimeUpsertRecord(db, teamId, afterData); // Update
    const afterSnap = await teamsModel.realtimeFindRecord(db, teamId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.teamWrite);
    await wrapped(changeSnap, { params: { teamId } });

    // Test results
    const result = await teamsModel.firestoreFindRecord(fs, teamId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
