const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Deficient Items Property Meta Sync', () => {
  afterEach(() => cleanDb(db));

  it('should not update property meta when an item\'s required action status does not change', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
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
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'requires-action' }); // obvs requires action
    const beforeSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`).once('value'); // Create before
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'go-back' }); // still requires action
    const afterSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, inspectionId, itemId } });

    // Test result
    const actual = await db.ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, 'did not update property\'s "numOfRequiredActionsForDeficientItems"');
  });

  it('should update property meta when an item\'s required action status changes', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
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
    await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'requires-action' }); // obvs requires action
    const beforeSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`).once('value'); // Create before
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'completed' }); // NOT requiring action
    const afterSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, inspectionId, itemId } });

    // Test result
    const actualSnap = await db.ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(1, 'updated property\'s "numOfRequiredActionsForDeficientItems"');
  });
});
