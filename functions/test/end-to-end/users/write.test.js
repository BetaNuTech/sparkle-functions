const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const usersModel = require('../../../models/users');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Users | Write', () => {
  afterEach(() => cleanDb(db, fs));

  it('should create a new firestore record', async () => {
    const userId = uuid();
    const expected = {
      firstName: `test${uuid()}`,
    };

    // Setup Data
    const beforeSnap = await usersModel.realtimeFindRecord(db, userId);
    await usersModel.realtimeUpsertRecord(db, userId, expected); // Create
    const afterSnap = await usersModel.realtimeFindRecord(db, userId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.userWrite);
    await wrapped(changeSnap, { params: { userId } });

    // Test results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update an existing firestore record', async () => {
    const userId = uuid();
    const propertyId = uuid();
    const beforeData = {
      firstName: 'test',
      properties: {
        [propertyId]: true,
      },
    };
    const expected = {
      firstName: 'updated',
      properties: {
        [propertyId]: true,
        [uuid()]: true,
      },
    };

    // Setup Data
    await usersModel.realtimeUpsertRecord(db, userId, beforeData);
    await usersModel.firestoreUpsertRecord(fs, userId, beforeData);
    const beforeSnap = await usersModel.realtimeFindRecord(db, userId);
    await usersModel.realtimeUpsertRecord(db, userId, expected); // Update
    const afterSnap = await usersModel.realtimeFindRecord(db, userId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.userWrite);
    await wrapped(changeSnap, { params: { userId } });

    // Test results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should deeply update an existing firestore records team property associations', async () => {
    const userId = uuid();
    const team = uuid();
    const propertyId = uuid();
    const beforeData = {
      teams: {
        [team]: true,
      },
    };
    const expected = {
      teams: {
        [team]: {
          [propertyId]: true,
        },
      },
    };

    // Setup Data
    await usersModel.realtimeUpsertRecord(db, userId, beforeData);
    await usersModel.firestoreUpsertRecord(fs, userId, beforeData);
    const beforeSnap = await usersModel.realtimeFindRecord(db, userId);
    await usersModel.realtimeUpsertRecord(db, userId, expected); // Update
    const afterSnap = await usersModel.realtimeFindRecord(db, userId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.userWrite);
    await wrapped(changeSnap, { params: { userId } });

    // Test results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should remove all firestore property and team associations of existing record', async () => {
    const userId = uuid();
    const beforeData = {
      firstName: 'test',
      properties: {
        [uuid()]: true,
      },
      teams: {
        [uuid()]: true,
      },
    };
    const expected = {
      firstName: 'updated',
    };

    // Setup Data
    await usersModel.realtimeUpsertRecord(db, userId, beforeData);
    await usersModel.firestoreUpsertRecord(fs, userId, beforeData);
    const beforeSnap = await usersModel.realtimeFindRecord(db, userId);
    await usersModel.realtimeUpsertRecord(db, userId, {
      ...expected,
      properties: null,
      teams: null,
    }); // Update
    const afterSnap = await usersModel.realtimeFindRecord(db, userId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.userWrite);
    await wrapped(changeSnap, { params: { userId } });

    // Test results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should delete firestore record when realtime is deleted', async () => {
    const expected = false;
    const userId = uuid();
    const userData = {
      firstName: `test ${uuid()}`,
    };

    // Setup Data
    await usersModel.realtimeUpsertRecord(db, userId, userData);
    await usersModel.firestoreUpsertRecord(fs, userId, userData);
    const beforeSnap = await usersModel.realtimeFindRecord(db, userId);
    await usersModel.realtimeRemoveRecord(db, userId);
    const afterSnap = await usersModel.realtimeFindRecord(db, userId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.userWrite);
    await wrapped(changeSnap, { params: { userId } });

    // Test results
    const result = await usersModel.firestoreFindRecord(fs, userId);
    const actual = result.exists;

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
