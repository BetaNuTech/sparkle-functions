const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Inspections | On Create Watcher', () => {
  afterEach(() => cleanDb(db, fs));

  it('should create a firestore inspection matching the realtime inspection', async () => {
    const propertyId = uuid();
    const inspId = uuid();
    const data = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      score: 65,
    });

    // Setup Database
    await inspectionsModel.realtimeUpsertRecord(db, inspId, data); // Add inspection #1
    const snap = await inspectionsModel.findRecord(db, inspId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionCreate);
    await wrapped(snap, { params: { inspectionId: inspId } });

    // Test results
    const inspSnap = await inspectionsModel.findRecord(db, inspId);
    const inspDoc = await inspectionsModel.firestoreFindRecord(fs, inspId);
    const expected = inspSnap.val();
    const actual = inspDoc.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
