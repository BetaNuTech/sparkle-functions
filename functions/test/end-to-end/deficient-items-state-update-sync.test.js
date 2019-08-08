const { expect } = require('chai');
const nock = require('nock');
const config = require('../../config');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('./setup');
const TRELLO_PUT_CARD_RESPONSE = require('../../test-helpers/mocks/put-trello-card.json');

const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;
const TRELLO_CARD_ID = uuid();
const TRELLO_CLOSE_LIST_ID = uuid();
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const SYSTEM_INTEGRATION_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}`;
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  member: uuid(),
  user: uuid(),
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const TRELLO_PROPERTY_INTEGRATION_DATA = {
  board: uuid(),
  boardName: 'Board',
  closeList: TRELLO_CLOSE_LIST_ID,
  closeListName: 'Done',
};

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

  it("should move a closed deficient item's trello card to the configured closed list", async () => {
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

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(
        `https://api.trello.com/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&idList=${TRELLO_CLOSE_LIST_ID}`
      )
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

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
    await db
      .ref(`${SYSTEM_INTEGRATION_PATH}/trello/organization`)
      .set(TRELLO_SYSTEM_INTEGRATION_DATA); // Trello credentials
    await db
      .ref(`${SYSTEM_INTEGRATION_PATH}/trello/properties/${propertyId}/cards`)
      .set({ [TRELLO_CARD_ID]: diID }); // Trello card reference
    await db
      .ref(`/integrations/trello/properties/${propertyId}`)
      .set(TRELLO_PROPERTY_INTEGRATION_DATA); // Trello closed list configuration
    const beforeSnap = await db.ref(`${diPath}/state`).once('value'); // Create before
    await diRef.update({ state: 'closed' });
    const afterSnap = await db.ref(`${diPath}/state`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsPropertyMetaSync);
    await wrapped(changeSnap, { params: { propertyId, itemId: diID } });

    // Assertion
    // Throws error if request not performed
    return cardUpdate.done();
  });
});
