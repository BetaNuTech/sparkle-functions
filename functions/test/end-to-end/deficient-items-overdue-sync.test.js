const { expect } = require('chai');
const config = require('../../config');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;

describe('Deficient Items Overdue Sync', () => {
  afterEach(() => cleanDb(db));

  it('should not set non-pending, past due, deficiency items to overdue', async () => {
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
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });
    const expected = {
      state: REQUIRED_ACTIONS_VALUES[0], // not pending
      numOfRequiredActionsForDeficientItems: 0
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}`, numOfRequiredActionsForDeficientItems: expected.numOfRequiredActionsForDeficientItems });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}`).set({
      state: expected.state,
      inspection: inspectionId,
      currentDueDate: (Date.now() / 1000) - 100000 // past due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test result
    const result = await Promise.all([
      db.ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`).once('value'),
      db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}/state`).once('value')
    ]);
    const [actualReqActions, actualState]  = result.map(r => r.val());

    // Assertions
    expect(actualState).to.equal(expected.state, 'did not update DI state');
    expect(actualReqActions).to.equal(expected.numOfRequiredActionsForDeficientItems, 'did not update property meta');
  });

  it('should not set pending, non-due, deficiency items to overdue', async () => {
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
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });
    const expected = {
      state: 'pending',
      numOfRequiredActionsForDeficientItems: 0
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}`, numOfRequiredActionsForDeficientItems: expected.numOfRequiredActionsForDeficientItems });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}`).set({
      state: expected.state,
      inspection: inspectionId,
      currentDueDate: (Date.now() / 1000) + 100000 // not due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test result
    const result = await Promise.all([
      db.ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`).once('value'),
      db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}/state`).once('value')
    ]);
    const [actualReqActions, actualState]  = result.map(r => r.val());

    // Assertions
    expect(actualState).to.equal(expected.state, 'did not update DI state');
    expect(actualReqActions).to.equal(expected.numOfRequiredActionsForDeficientItems, 'did not update property meta');
  });

  it('should set all pending, past due, deficiency items to overdue', async () => {
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
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });
    const expected = {
      state: 'overdue',
      startDate: (Date.now() / 1000) - 100,
      numOfRequiredActionsForDeficientItems: 1
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}`, numOfRequiredActionsForDeficientItems: 0 });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}`).set({
      state: 'pending',
      inspection: inspectionId,
      currentStartDate: expected.startDate,
      currentDueDate: (Date.now() / 1000) - 100000 // past due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test result
    const result = await Promise.all([
      db.ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`).once('value'),
      db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}/state`).once('value'),
      db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}/stateHistory`).once('value'),
      db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}/updatedAt`).once('value')
    ]);
    const [actualReqActions, actualState, allStateHistory, actualUpdatedAt]  = result.map(r => r.val());
    const actualStateHistory = allStateHistory ? allStateHistory[Object.keys(allStateHistory)[0]] : {}; // Get 1st from hash

    // Assertions
    expect(actualState).to.equal(expected.state, 'updated DI state');
    expect(actualStateHistory.state).to.equal(expected.state, 'updated state history with latest state');
    expect(actualStateHistory.startDate).to.equal(expected.startDate, 'updated state history with current start date');
    expect(actualReqActions).to.equal(expected.numOfRequiredActionsForDeficientItems, 'updated property meta');
    expect(actualUpdatedAt).to.be.a('number', 'modified DI updatedAt');
  });
});
