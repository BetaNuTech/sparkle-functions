const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const templateCategories = require('../../../models/template-categories');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Template Categories | Write', () => {
  afterEach(() => cleanDb(db, fs));

  it('should create a new firestore record', async () => {
    const categoryId = uuid();
    const expected = {
      name: `test ${uuid()}`,
    };

    // Setup Data
    const beforeSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );
    await templateCategories.realtimeUpsertRecord(db, categoryId, expected); // Create
    const afterSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateCategoryWrite);
    await wrapped(changeSnap, { params: { categoryId } });

    // Test results
    const result = await templateCategories.firestoreFindRecord(fs, categoryId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update an existing firestore record', async () => {
    const categoryId = uuid();
    const beforeData = {
      name: 'test 1',
    };
    const expected = {
      name: 'updated test 2',
    };

    // Setup Data
    await templateCategories.realtimeUpsertRecord(db, categoryId, beforeData);
    const beforeSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );
    await templateCategories.realtimeUpsertRecord(db, categoryId, expected); // Update
    const afterSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateCategoryWrite);
    await wrapped(changeSnap, { params: { categoryId } });

    // Test results
    const result = await templateCategories.firestoreFindRecord(fs, categoryId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should do nothing when a record is deleted', async () => {
    const categoryId = uuid();
    const expected = {
      name: `test ${uuid()}`,
    };

    // Setup Data
    await templateCategories.realtimeUpsertRecord(db, categoryId, expected);
    await templateCategories.firestoreUpsertRecord(fs, categoryId, expected);
    const beforeSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );
    await templateCategories.realtimeRemoveRecord(db, categoryId);
    const afterSnap = await templateCategories.realtimeFindRecord(
      db,
      categoryId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateCategoryWrite);
    await wrapped(changeSnap, { params: { categoryId } });

    // Test results
    const result = await templateCategories.firestoreFindRecord(fs, categoryId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
