const { expect } = require('chai');
const config = require('../../config');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const {
  db,
  test,
  pubsub,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../setup');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;
const SYSTEM_INTEGRATION_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}`;

describe('Deficient Items Property Meta Sync', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(SYSTEM_INTEGRATION_PATH).remove();
  });

  it("should not update property meta when an item's required action status does not change", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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

    // Test updates between all required action states
    for (let i = 0; i < REQUIRED_ACTIONS_VALUES.length; i++) {
      const initalActionState = REQUIRED_ACTIONS_VALUES[i];
      const updatedActionState =
        REQUIRED_ACTIONS_VALUES[i + 1] || REQUIRED_ACTIONS_VALUES[0]; // next or first required action

      // Setup database
      await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
      await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
      const diRef = db
        .ref(`/propertyInspectionDeficientItems/${propertyId}`)
        .push();
      const diPath = diRef.path.toString();
      const diID = diPath.split('/').pop();
      await diRef.set({
        state: initalActionState, // requires action
        inspection: inspectionId,
        item: itemId,
      });
      const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
      await diRef.set({
        state: updatedActionState, // still requires action
        inspection: inspectionId,
        item: itemId,
      });
      const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
      await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

      // Test result
      const actual = await db
        .ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`)
        .once('value');

      // Assertions
      expect(actual.exists()).to.equal(
        false,
        'did not update property\'s "numOfRequiredActionsForDeficientItems"'
      );
    }
  });

  it("should not update property meta when an item's follow up action status does not change", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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

    // Test updates between all required action states
    for (let i = 0; i < FOLLOW_UP_ACTION_VALUES.length; i++) {
      const initalActionState = FOLLOW_UP_ACTION_VALUES[i];
      const updatedActionState =
        FOLLOW_UP_ACTION_VALUES[i + 1] || FOLLOW_UP_ACTION_VALUES[0]; // next or first follow up action

      // Setup database
      await db.ref(`/properties/${propertyId}`).set({ name: 'test' });
      await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
      const diRef = db
        .ref(`/propertyInspectionDeficientItems/${propertyId}`)
        .push();
      const diPath = diRef.path.toString();
      const diID = diPath.split('/').pop();
      await diRef.set({
        state: initalActionState, // obvs requires action
        inspection: inspectionId,
        item: itemId,
      });
      const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
      await diRef.set({
        state: updatedActionState, // still requires action
        inspection: inspectionId,
        item: itemId,
      });
      const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
      await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

      // Test result
      const actual = await db
        .ref(`/properties/${propertyId}/numOfFollowUpActionsForDeficientItems`)
        .once('value');

      // Assertions
      expect(actual.exists()).to.equal(
        false,
        'did not update property\'s "numOfFollowUpActionsForDeficientItems"'
      );
    }
  });

  it("should update property meta when an item's required action status changes", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    const diID = diPath.split('/').pop();
    await diRef.set({
      state: FOLLOW_UP_ACTION_VALUES[0], // NOT requiring action
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
    await diRef.set({
      state: REQUIRED_ACTIONS_VALUES[0], // Requires action
      inspection: inspectionId,
      item: itemId,
    });
    const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Test result
    const actualSnap = await db
      .ref(`/properties/${propertyId}/numOfRequiredActionsForDeficientItems`)
      .once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(
      1,
      'updated property\'s "numOfRequiredActionsForDeficientItems"'
    );
  });

  it("should update property meta when an item's follow up action status changes", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const diRef = db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push();
    const diPath = diRef.path.toString();
    const diID = diPath.split('/').pop();
    await diRef.set({
      state: REQUIRED_ACTIONS_VALUES[0], // requires action
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
    await diRef.set({
      state: FOLLOW_UP_ACTION_VALUES[0], // NOT requiring action
      inspection: inspectionId,
      item: itemId,
    });
    const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Test result
    const actualSnap = await db
      .ref(`/properties/${propertyId}/numOfFollowUpActionsForDeficientItems`)
      .once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(
      1,
      'updated property\'s "numOfFollowUpActionsForDeficientItems"'
    );
  });

  it("should decrement property's total DI counter when they become closed", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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
      .set({ name: 'test', numOfDeficientItems: 1 });
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
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
    const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
    await diRef.update({ state: 'closed' });
    const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Test result
    const actualSnap = await db
      .ref(`/properties/${propertyId}/numOfDeficientItems`)
      .once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(0);
  });

  it('should publish a deficient item state update event to subscribers', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficientItemId = uuid();
    const itemId = uuid();
    const newState = FOLLOW_UP_ACTION_VALUES[0];

    let actual = '';
    const expected = `${propertyId}/${deficientItemId}/state/${newState}`;
    const unsubscribe = pubsub.subscribe(
      'deficient-item-status-update',
      data => {
        actual = Buffer.from(data, 'base64').toString();
      }
    );

    const beforeData = mocking.createInspection({
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
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const diPath = `/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}`;
    const diRef = db.ref(diPath);
    await diRef.set({
      state: REQUIRED_ACTIONS_VALUES[0], // requires action
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
    await diRef.update({ state: newState });
    const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, {
      params: { propertyId, itemId: deficientItemId },
    });

    expect(actual).to.equal(expected);

    // Cleanup
    unsubscribe();
  });
});
