const { expect } = require('chai');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const diModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, test, pubsub, cloudFunctions } = require('../../setup');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;

describe('Deficient Items | Property Meta Sync', () => {
  afterEach(() => cleanDb(null, fs));

  it("should not update property meta when an item's required action status does not change", async () => {
    const expected = false;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test' };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection

    // Test updates between all required action states
    for (let i = 0; i < REQUIRED_ACTIONS_VALUES.length; i++) {
      const initalActionState = REQUIRED_ACTIONS_VALUES[i];
      const updatedActionState =
        REQUIRED_ACTIONS_VALUES[i + 1] || REQUIRED_ACTIONS_VALUES[0]; // next or first required action
      const beforeData = {
        state: initalActionState, // requires action
        inspection: inspectionId,
        property: propertyId,
        item: itemId,
      };
      const afterData = {
        state: updatedActionState,
      };

      // Setup database
      await diModel.upsertRecord(fs, deficiencyId, beforeData);
      const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
      await diModel.updateRecord(fs, deficiencyId, afterData);
      const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(
        cloudFunctions.deficientItemsPropertyMetaSyncV2
      );
      await wrapped(changeSnap, { params: { deficiencyId } });

      // Test result
      const result = await propertiesModel.findRecord(fs, propertyId);
      const actual = Boolean(
        result.data().numOfRequiredActionsForDeficientItems
      );

      // Assertions
      expect(actual).to.equal(
        expected,
        "did not update property's number of required actions counter"
      );
    }
  });

  it("should not update property meta when an item's follow up action status does not change", async () => {
    const expected = false;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test' };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection

    // Test updates between all required action states
    for (let i = 0; i < FOLLOW_UP_ACTION_VALUES.length; i++) {
      const initalActionState = FOLLOW_UP_ACTION_VALUES[i];
      const updatedActionState =
        FOLLOW_UP_ACTION_VALUES[i + 1] || FOLLOW_UP_ACTION_VALUES[0]; // next or first follow up action
      const beforeData = {
        state: initalActionState, // obvs requires action
        inspection: inspectionId,
        item: itemId,
        property: propertyId,
      };
      const afterData = {
        state: updatedActionState, // still requires action
      };

      // Setup database
      await diModel.upsertRecord(fs, deficiencyId, beforeData);
      const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
      await diModel.updateRecord(fs, deficiencyId, afterData);
      const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(
        cloudFunctions.deficientItemsPropertyMetaSyncV2
      );
      await wrapped(changeSnap, { params: { deficiencyId } });

      // Test result
      const result = await propertiesModel.findRecord(fs, propertyId);
      const actual = Boolean(
        result.data().numOfFollowUpActionsForDeficientItems
      );

      // Assertions
      expect(actual).to.equal(
        expected,
        "did not update property's number of follow up actions counter"
      );
    }
  });

  it("should update property meta when an item's required action status changes", async () => {
    const expected = 1;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test' };
    const beforeData = {
      state: FOLLOW_UP_ACTION_VALUES[0], // NOT requiring action
      inspection: inspectionId,
      item: itemId,
      property: propertyId,
    };
    const afterData = {
      state: REQUIRED_ACTIONS_VALUES[0], // Requires action
    };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection
    await diModel.createRecord(fs, deficiencyId, beforeData);
    const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
    await diModel.updateRecord(fs, deficiencyId, afterData);
    const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test result
    const result = await propertiesModel.findRecord(fs, propertyId);
    const actual = result.data().numOfRequiredActionsForDeficientItems;

    // Assertions
    expect(actual).to.equal(
      expected,
      "updated property's number of required actions counter"
    );
  });

  it("should update property meta when an item's follow up action status changes", async () => {
    const expected = 1;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test' };
    const beforeData = {
      state: REQUIRED_ACTIONS_VALUES[0], // requires action
      inspection: inspectionId,
      item: itemId,
      property: propertyId,
    };
    const afterData = {
      state: FOLLOW_UP_ACTION_VALUES[0], // NOT requiring action
    };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection
    await diModel.createRecord(fs, deficiencyId, beforeData);
    const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
    await diModel.updateRecord(fs, deficiencyId, afterData);
    const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test result
    const result = await propertiesModel.findRecord(fs, propertyId);
    const actual = result.data().numOfFollowUpActionsForDeficientItems;

    // Assertions
    expect(actual).to.equal(
      expected,
      "updated property's number of follow up actions counter"
    );
  });

  it("should decrement property's total DI counter when they become closed", async () => {
    const expected = 0;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test', numOfDeficientItems: 1 };
    const beforeData = {
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
      property: propertyId,
    };
    const afterData = { state: 'closed' };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection
    await diModel.createRecord(fs, deficiencyId, beforeData);
    const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
    await diModel.updateRecord(fs, deficiencyId, afterData);
    const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test result
    const result = await propertiesModel.findRecord(fs, propertyId);
    const actual = result.data().numOfDeficientItems;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should publish a deficient item state update event to subscribers', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const itemId = uuid();
    const newState = FOLLOW_UP_ACTION_VALUES[0];
    let actual = '';
    const expected = `${propertyId}/${deficiencyId}/state/${newState}`;
    const unsubscribe = pubsub.subscribe(
      'deficient-item-status-update',
      data => {
        actual = Buffer.from(data, 'base64').toString();
      }
    );
    const inspData = mocking.createInspection({
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
    const propertyData = { name: 'test' };
    const beforeData = {
      state: REQUIRED_ACTIONS_VALUES[0], // requires action
      inspection: inspectionId,
      item: itemId,
      property: propertyId,
    };
    const afterData = { state: newState };

    // Setup database
    await propertiesModel.createRecord(fs, propertyId, propertyData);
    await inspectionsModel.createRecord(fs, inspectionId, inspData); // Add inspection
    await diModel.createRecord(fs, deficiencyId, beforeData);
    const beforeSnap = await diModel.findRecord(fs, deficiencyId); // Create before
    await diModel.updateRecord(fs, deficiencyId, afterData);
    const afterSnap = await diModel.findRecord(fs, deficiencyId); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSyncV2);
    await wrapped(changeSnap, {
      params: { deficiencyId },
    });

    expect(actual).to.equal(expected);

    // Cleanup
    unsubscribe();
  });
});
