const { expect } = require('chai');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const timeMocking = require('../../../test-helpers/time');
const { cleanDb } = require('../../../test-helpers/firebase');
const diModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { db, fs, test, cloudFunctions } = require('../../setup');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

describe('Deficient Items | Firestore | Overdue Sync', () => {
  afterEach(() => cleanDb(db, fs));

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
    const deficientItem = {
      state: REQUIRED_ACTIONS_VALUES[0], // not eligible to be "overdue"
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.twoDaysAgo,
      currentDueDate: timeMocking.age.oneDayAgo, // past due
    };
    const propertyData = {
      name: `name${propertyId}`,
      numOfRequiredActionsForDeficientItems: 0,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection

    const deficientItemPojo = await diModel.createRecord(
      db,
      fs,
      propertyId,
      deficientItem
    );
    const [diPath] = Object.keys(deficientItemPojo);
    const deficientItemId = diPath.split('/').pop();
    await diModel.firestoreCreateRecord(fs, deficientItemId, {
      ...deficientItem,
      property: propertyId,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test result
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);

    // Assertions
    [
      {
        actual: (propertyDoc.data() || {})
          .numOfRequiredActionsForDeficientItems,
        expected: propertyData.numOfRequiredActionsForDeficientItems,
        msg: 'did not update property meta',
      },
      {
        actual: (defItemDoc.data() || {}).state,
        expected: deficientItem.state,
        msg: 'did not update DI state',
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
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
      const propertyData = {
        name: `name${propertyId}`,
        numOfRequiredActionsForDeficientItems: 0,
      };
      const deficientItem = {
        state: eligibleState,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: timeMocking.age.twoDaysAgo,
        currentDueDate: timeMocking.age.oneDayFromNow, // not due
      };

      // Setup database
      await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
      await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
      await inspectionsModel.realtimeUpsertRecord(
        db,
        inspectionId,
        inspectionData
      ); // Add inspection

      const deficientItemPojo = await diModel.createRecord(
        db,
        fs,
        propertyId,
        deficientItem
      );
      const [diPath] = Object.keys(deficientItemPojo);
      const deficientItemId = diPath.split('/').pop();
      await diModel.firestoreCreateRecord(fs, deficientItemId, {
        ...deficientItem,
        property: propertyId,
      });

      // Execute
      await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

      // Test result
      const propertyDoc = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);

      // Assertions
      [
        {
          actual: (propertyDoc.data() || {})
            .numOfRequiredActionsForDeficientItems,
          expected: propertyData.numOfRequiredActionsForDeficientItems,
          msg: 'did not update property meta',
        },
        {
          actual: (defItemDoc.data() || {}).state,
          expected: deficientItem.state,
          msg: 'did not update DI state',
        },
      ].forEach(({ actual, expected, msg }) =>
        expect(actual).to.equal(expected, msg)
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
    const updates = {
      state: 'overdue',
      startDate: timeMocking.age.sixDaysAgo,
      numOfRequiredActionsForDeficientItems: 1,
    };

    for (let i = 0; i < OVERDUE_ELIGIBLE_STATES.length; i++) {
      const eligibleState = OVERDUE_ELIGIBLE_STATES[i];
      const propertyData = {
        name: `name${propertyId}`,
        numOfRequiredActionsForDeficientItems: 0,
      };
      const deficientItem = {
        state: eligibleState,
        inspection: inspectionId,
        item: itemId,
        currentStartDate: updates.startDate,
        currentDueDate: timeMocking.age.oneDayAgo, // past due
      };

      // Setup database
      await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
      await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
      await inspectionsModel.realtimeUpsertRecord(
        db,
        inspectionId,
        inspectionData
      ); // Add inspection

      const deficientItemPojo = await diModel.createRecord(
        db,
        fs,
        propertyId,
        deficientItem
      );
      const [diPath] = Object.keys(deficientItemPojo);
      const deficientItemId = diPath.split('/').pop();
      await diModel.firestoreCreateRecord(fs, deficientItemId, {
        ...deficientItem,
        property: propertyId,
      });

      // Execute
      await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

      // Test result
      const propertyDoc = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);
      const stateHistory = (defItemDoc.data() || {}).stateHistory || {};
      const firstStateHistory = Object.values(stateHistory)[0] || {};

      // Assertions
      [
        {
          actual: (propertyDoc.data() || {})
            .numOfRequiredActionsForDeficientItems,
          expected: updates.numOfRequiredActionsForDeficientItems,
          msg: 'updated property meta',
        },
        {
          actual: (defItemDoc.data() || {}).state,
          expected: updates.state,
          msg: 'updated state with new state',
        },
        {
          actual: firstStateHistory.state,
          expected: updates.state,
          msg: 'updated state history with latest state',
        },
        {
          actual: firstStateHistory.startDate,
          expected: updates.startDate,
          msg: 'updated state history with current start date',
        },
        {
          actual: typeof (defItemDoc.data() || {}).updatedAt,
          expected: 'number',
          msg: 'incremented updated at',
        },
      ].forEach(({ actual, expected, msg }) =>
        expect(actual).to.equal(expected, msg)
      );
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
    const propertyData = { name: `name${propertyId}` };
    const expected = 'pending';
    const deficientItem = {
      state: expected,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.twoDaysAgo, // ineligible for requires progress state
      currentDueDate: timeMocking.age.oneDayFromNow, // over 1/2 past due
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const deficientItemPojo = await diModel.createRecord(
      db,
      fs,
      propertyId,
      deficientItem
    );
    const [diPath] = Object.keys(deficientItemPojo);
    const deficientItemId = diPath.split('/').pop();
    await diModel.firestoreCreateRecord(fs, deficientItemId, {
      ...deficientItem,
      property: propertyId,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);
    const actual = (defItemDoc.data() || {}).state;

    // Assertions
    expect(actual).to.equal(expected);
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
    const propertyData = { name: `name${propertyId}` };
    const expected = 'pending';
    const deficientItem = {
      state: expected,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.fiveDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.sixDaysFromNow, // under 1/2 past due
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const deficientItemPojo = await diModel.createRecord(
      db,
      fs,
      propertyId,
      deficientItem
    );
    const [diPath] = Object.keys(deficientItemPojo);
    const deficientItemId = diPath.split('/').pop();
    await diModel.firestoreCreateRecord(fs, deficientItemId, {
      ...deficientItem,
      property: propertyId,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);
    const actual = (defItemDoc.data() || {}).state;

    // Assertions
    expect(actual).to.equal(expected);
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
    const propertyData = { name: `name${propertyId}` };
    const expected = 'pending';
    const deficientItem = {
      state: expected,
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
      willRequireProgressNote: false, // Progress notes not needed
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const deficientItemPojo = await diModel.createRecord(
      db,
      fs,
      propertyId,
      deficientItem
    );
    const [diPath] = Object.keys(deficientItemPojo);
    const deficientItemId = diPath.split('/').pop();
    await diModel.firestoreCreateRecord(fs, deficientItemId, {
      ...deficientItem,
      property: propertyId,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);
    const actual = (defItemDoc.data() || {}).state;

    // Assertions
    expect(actual).to.equal(expected);
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
    const propertyData = { name: `name${propertyId}` };
    const expected = 'requires-progress-update';
    const deficientItem = {
      state: 'pending',
      inspection: inspectionId,
      item: itemId,
      currentStartDate: timeMocking.age.threeDaysAgo, // eligible for requires progress state
      currentDueDate: timeMocking.age.twoDaysFromNow, // over 1/2 past due
      willRequireProgressNote: true,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData);
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, propertyData);
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const deficientItemPojo = await diModel.createRecord(
      db,
      fs,
      propertyId,
      deficientItem
    );
    const [diPath] = Object.keys(deficientItemPojo);
    const deficientItemId = diPath.split('/').pop();
    await diModel.firestoreCreateRecord(fs, deficientItemId, {
      ...deficientItem,
      property: propertyId,
    });

    // Execute
    await test.wrap(cloudFunctions.deficientItemsOverdueSync)();

    // Test Result
    const defItemDoc = await diModel.firestoreFindRecord(fs, deficientItemId);
    const actual = (defItemDoc.data() || {}).state;

    // Assertions
    expect(actual).to.equal(expected);
  });
});
