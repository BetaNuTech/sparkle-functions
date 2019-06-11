const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Deficient Items Archiving', () => {
  afterEach(() => cleanDb(db));

  it('should not archive a deficient item when not archived', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    const diID = diPath.split('/').pop();
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Test result
    const actual = await db
      .ref(`/archive/propertyInspectionDeficientItems/${propertyId}/${diID}`)
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(
      false,
      'did not archive the deficient item'
    );
  });

  it('should archive a deficient item when requested', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    const diID = diPath.split('/').pop();
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: true });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Test result
    const actual = await db
      .ref(`/archive/propertyInspectionDeficientItems/${propertyId}/${diID}`)
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'archived the deficient item');
  });
});
