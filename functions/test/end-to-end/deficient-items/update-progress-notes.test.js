const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const diModel = require('../../../models/deficient-items');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Deficient Items | Update Progress Note', () => {
  afterEach(async () => {
    await cleanDb(db, fs);
  });

  it('should create a new progress note on a Firestore deficient item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const progressNoteId = uuid();
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };
    const expected = {
      [progressNoteId]: createProgressNote(),
    };

    // Setup database
    await diModel.realtimeUpsertRecord(
      db,
      propertyId,
      deficiencyId,
      deficiencyData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const beforeSnap = await diModel.realtimeFindRecordProgressNote(
      db,
      propertyId,
      deficiencyId,
      progressNoteId
    );
    await diModel.realtimeUpdateRecord(db, propertyId, deficiencyId, {
      progressNotes: expected,
    });
    const afterSnap = await diModel.realtimeFindRecordProgressNote(
      db,
      propertyId,
      deficiencyId,
      progressNoteId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsProgressNotesSync);
    await wrapped(changeSnap, {
      params: { propertyId, deficiencyId, progressNoteId },
    });

    // Test result
    const result = await diModel.firestoreFindRecord(fs, deficiencyId);
    const { progressNotes: actual = null } = result.data() || {};

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should not modify existing fields or other progress notes', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const progressNoteId = uuid();
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      progressNotes: {
        [uuid()]: createProgressNote(),
      },
    };
    const progressNoteUpdate = {
      [progressNoteId]: createProgressNote(),
    };
    const expected = { ...deficiencyData };
    Object.assign(expected.progressNotes, progressNoteUpdate);

    // Setup database
    await diModel.realtimeUpsertRecord(
      db,
      propertyId,
      deficiencyId,
      deficiencyData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const beforeSnap = await diModel.realtimeFindRecordProgressNote(
      db,
      propertyId,
      deficiencyId,
      progressNoteId
    );
    await diModel.realtimeUpdateRecord(db, propertyId, deficiencyId, {
      progressNotes: progressNoteUpdate,
    });
    const afterSnap = await diModel.realtimeFindRecordProgressNote(
      db,
      propertyId,
      deficiencyId,
      progressNoteId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsProgressNotesSync);
    await wrapped(changeSnap, {
      params: { propertyId, deficiencyId, progressNoteId },
    });

    // Test result
    const result = await diModel.firestoreFindRecord(fs, deficiencyId);
    const actual = result.data() || null;

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});

/**
 * Generate a new progress note entry
 * @param  {Object?} config
 * @return {Object}
 */
function createProgressNote(config = {}) {
  const now = Math.round(Date.now() / 1000);
  return Object.assign(
    {
      createdAt: now - 10000,
      progressNote: 'Progress note',
      startDate: now + 10000,
      user: uuid(),
    },
    config
  );
}
