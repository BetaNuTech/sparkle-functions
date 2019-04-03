const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Deficient Items Create and Delete', () => {
  afterEach(() => cleanDb(db));

  it('should remove all deficient items associated with a deleted inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const otherInspItemId = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create single deficient item on inspection
      template: {
        items: {
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'required-action' });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).remove(); // remove inspection
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsCreateDelete);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(null, 'removed all inspection deficient items');
  });

  it('should remove each deficient item that belongs to an approved inspection items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        items: {
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true), // target to make non-deficient
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });

    const expected = { [item2Id]: { state: 'required-action' } };
    const removedDeficientItem = { state: 'required-action' };

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).set(expected); // Setup expected DI
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item1Id}`).set(removedDeficientItem);
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // Mark 1st item as non-deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsCreateDelete);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should create deficient items for a newly deficient inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two NON-deficient items on inspection
      template: {
        items: {
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false),
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false)
        }
      }
    });

    const expected = [item1Id, item2Id];

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
    );
    await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsCreateDelete);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = Object.keys(actualSnap.val() || {});

    // Assertions
    expect(actual.includes(item1Id)).to.equal(true, 'created deficient item #1');
    expect(actual.includes(item2Id)).to.equal(true, 'created deficient item #2');
  });

  it('should add a newly deficient item to existing deficient items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        items: {
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true),
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // target to make deficient
        }
      }
    });

    const expected = [item1Id, item2Id];

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item1Id}`).set({ state: 'required-action' });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsCreateDelete);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actual = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item2Id}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'created deficient item #2');
  });
});
