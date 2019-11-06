const { expect } = require('chai');
const config = require('../../config');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const timeMocking = require('../../test-helpers/time');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

describe('Deficient Items Overdue Sync', () => {
  afterEach(() => cleanDb(db));

  it('should not set ineligible, past due, deficiency items to overdue', async () => {
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
    const expected = {
      state: REQUIRED_ACTIONS_VALUES[0], // not eligible to be "overdue"
      numOfRequiredActionsForDeficientItems: 0,
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({
      name: `name${propertyId}`,
      numOfRequiredActionsForDeficientItems:
        expected.numOfRequiredActionsForDeficientItems,
    });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    await diRef.set({
      state: expected.state,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.twoDaysAgo,
      currentDueDate: timeMocking.age.oneDayAgo, // past due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test result
    const result = await Promise.all([
      db
        .ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`)
        .once('value'),
      db.ref(`${diPath}/state`).once('value'),
    ]);
    const [actualReqActions, actualState] = result.map(r => r.val());

    // Assertions
    expect(actualState).to.equal(expected.state, 'did not update DI state');
    expect(actualReqActions).to.equal(
      expected.numOfRequiredActionsForDeficientItems,
      'did not update property meta'
    );
  });

  it('should not set eligible, non-due, deficiency items to overdue', async () => {
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

    for (let i = 0; i < OVERDUE_ELIGIBLE_STATES.length; i++) {
      const eligibleState = OVERDUE_ELIGIBLE_STATES[i];
      const expected = {
        state: eligibleState,
        numOfRequiredActionsForDeficientItems: 0,
      };

      // Setup database
      await db.ref(`/properties/${propertyId}`).set({
        name: `name${propertyId}`,
        numOfRequiredActionsForDeficientItems:
          expected.numOfRequiredActionsForDeficientItems,
      });
      await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
      const diRef = db
        .ref(`/propertyInspectionDeficientItems/${propertyId}/${itemId}`)
        .push();
      const diPath = diRef.path.toString();
      await diRef.set({
        state: expected.state,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: timeMocking.age.twoDaysAgo,
        currentDueDate: timeMocking.age.oneDayFromNow, // not due
      });

      // Execute
      await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

      // Test result
      const result = await Promise.all([
        db
          .ref(
            `/properties/${propertyId}/numOfRequiredActionsForDeficientItems`
          )
          .once('value'),
        db.ref(`${diPath}/state`).once('value'),
      ]);
      const [actualReqActions, actualState] = result.map(r => r.val());

      // Assertions
      expect(actualState).to.equal(expected.state, 'did not update DI state');
      expect(actualReqActions).to.equal(
        expected.numOfRequiredActionsForDeficientItems,
        'did not update property meta'
      );
    }
  });

  it('should set all eligible, past due, deficiency items to overdue', async () => {
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
    const expected = {
      state: 'overdue',
      startDate: timeMocking.age.sixDaysAgo,
      numOfRequiredActionsForDeficientItems: 1,
    };

    for (let i = 0; i < OVERDUE_ELIGIBLE_STATES.length; i++) {
      const eligibleState = OVERDUE_ELIGIBLE_STATES[i];

      // Setup database
      await db.ref(`/properties/${propertyId}`).set({
        name: `name${propertyId}`,
        numOfRequiredActionsForDeficientItems: 0,
      });
      await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
      const diRef = db
        .ref(`/propertyInspectionDeficientItems/${propertyId}`)
        .push();
      const diPath = diRef.path.toString();
      await diRef.set({
        state: eligibleState,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: expected.startDate,
        currentDueDate: timeMocking.age.oneDayAgo, // past due
      });

      // Execute
      await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

      // Test result
      const result = await Promise.all([
        db
          .ref(
            `/properties/${propertyId}/numOfRequiredActionsForDeficientItems`
          )
          .once('value'),
        db.ref(`${diPath}/state`).once('value'),
        db.ref(`${diPath}/stateHistory`).once('value'),
        db.ref(`${diPath}/updatedAt`).once('value'),
      ]);
      const [
        actualReqActions,
        actualState,
        allStateHistory,
        actualUpdatedAt,
      ] = result.map(r => r.val());
      const actualStateHistory = allStateHistory
        ? allStateHistory[Object.keys(allStateHistory)[0]]
        : {}; // Get 1st from hash

      // Assertions
      expect(actualState).to.equal(expected.state, 'updated DI state');
      expect(actualStateHistory.state).to.equal(
        expected.state,
        'updated state history with latest state'
      );
      expect(actualStateHistory.startDate).to.equal(
        expected.startDate,
        'updated state history with current start date'
      );
      expect(actualReqActions).to.equal(
        expected.numOfRequiredActionsForDeficientItems,
        'updated property meta'
      );
      expect(actualUpdatedAt).to.be.a('number', 'modified DI updatedAt');
    }
  });

  it('should not progress ineligible DI\'s, over half past due, to "requires-progress-update" state', async () => {
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
    const expected = { state: 'pending' };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    await diRef.set({
      state: expected.state,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.twoDaysAgo, // ineligible for requires progress state
      currentDueDate: timeMocking.age.oneDayFromNow, // over 1/2 past due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const actualSnap = await db.ref(`${diPath}/state`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(expected.state);
  });

  it('should not progress eligible DI\'s, under half past due, to "requires-progress-update" state', async () => {
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
    const expected = { state: 'pending' };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    await diRef.set({
      state: expected.state,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.fiveDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.sixDaysFromNow, // under 1/2 past due
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const actualSnap = await db.ref(`${diPath}/state`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(expected.state);
  });

  it('should not progress to "requires-progress-update" when DI does not require progress notes', async () => {
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
    const expected = { state: 'pending' };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    await diRef.set({
      state: 'pending',
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
      willRequireProgressNote: false, // Progress notes not needed
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const actualSnap = await db.ref(`${diPath}/state`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(expected.state);
  });

  it('should progress eligible DI\'s, under half past due, to "requires-progress-update" state', async () => {
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
    const expected = { state: 'requires-progress-update' };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    await diRef.set({
      state: 'pending',
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
      willRequireProgressNote: true,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const actualSnap = await db.ref(`${diPath}/state`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(expected.state);
  });

  it("should create a source notification when a DI's state is updated", async () => {
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
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData);
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    await diRef.set({
      state: 'pending',
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
      itemTitle: 'title',
      sectionTitle: 'sectionTitle',
      sectionSubtitle: 'sectionSubtitle',
      currentDueDateDay: '10/23/40',
      currentPlanToFix: 'currentPlanToFix',
      urrentResponsibilityGroup: 'site_level_manages_vendor',
      currentCompleteNowReason: 'currentCompleteNowReason',
      currentReasonIncomplete: 'currentReasonIncomplete',
      trelloCardURL: 'trelloCardURL',
      progressNotes: {
        createdAt: Math.round(Date.now() / 1000),
        progressNote: 'progressNote',
      },
      willRequireProgressNote: true,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const resultsSnap = await db.ref('/notifications/src').once('value');
    const result = resultsSnap.val();
    const actual = result ? Object.keys(result).length : 0;

    // Assertions
    expect(actual).to.be.greaterThan(0);
  });
});
