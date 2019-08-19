const { expect } = require('chai');
const nock = require('nock');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const TRELLO_API_CARD_PAYLOAD = require('../../test-helpers/mocks/get-trello-card.json');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('./setup');

const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const USER_ID = uuid();
const TRELLO_MEMBER_ID = '57c864cb46ef602b2be03a80';
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const TRELLO_CARD_ID = '5d0ab7754066f880369a4db2';
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  member: TRELLO_MEMBER_ID,
  user: USER_ID,
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const TRELLO_SYSTEM_PROPERTY_CARDS_DATA = {
  [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID,
};
const INTEGRATIONS_DATA = {
  grantedBy: USER_ID,
  grantedAt: Date.now() / 1000,
  openBoard: '5d0ab7754066f880369a4d97',
  openBoardName: 'Test Board',
  openList: '5d0ab7754066f880369a4d99',
  opentListName: 'TO DO',
};
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_PROPERTY_CARDS_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_INTEGRATIONS_DB_PATH = `/integrations/trello/properties/${PROPERTY_ID}`;
const DEFICIENT_ITEM_DB_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const DEFICIENT_ITEM_ARCHIVE_DB_PATH = `/archive${DEFICIENT_ITEM_DB_PATH}`;

describe('Deficient Items Archiving', () => {
  afterEach(async () => {
    await cleanDb(db);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

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
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId: diID },
    });

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
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId: diID },
    });

    // Test result
    const actual = await db
      .ref(`/archive/propertyInspectionDeficientItems/${propertyId}/${diID}`)
      .once('value');
    const actual2 = await db
      .ref(
        `/archive/propertyInspectionDeficientItems/${propertyId}/${diID}/archive`
      )
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'archived the deficient item');
    expect(actual2.val()).to.equal(
      true,
      'archived deficient item /archive should equal true'
    );
  });

  it('should archive a deficient items trello card when requested', async () => {
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [uuid()]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Stub Requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(
        200,
        Object.assign({}, TRELLO_API_CARD_PAYLOAD, {
          id: TRELLO_CARD_ID,
          closed: true,
        })
      );

    // Setup database
    await db.ref(`/properties/${PROPERTY_ID}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diPath = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
    const diRef = db.ref(diPath);
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      item: DEFICIENT_ITEM_ID,
    });

    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: true });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);
    await wrapped(changeSnap, {
      params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const actual = await db.ref(`/archive/${diPath}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'archived the deficient item');
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [uuid()]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await db.ref(`/properties/${PROPERTY_ID}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diRef = db.ref(DEFICIENT_ITEM_DB_PATH);
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      trelloCardURL: 'something',
    });
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db
      .ref(`${DEFICIENT_ITEM_DB_PATH}/archive`)
      .once('value'); // Create before
    await diRef.update({ archive: true });
    const afterSnap = await db
      .ref(`${DEFICIENT_ITEM_DB_PATH}/archive`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);

    try {
      await wrapped(changeSnap, {
        params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    const trelloCardDetailsSnap = await db
      .ref(`${TRELLO_PROPERTY_CARDS_PATH}/${TRELLO_CARD_ID}`)
      .once('value');
    const actualTrelloCardDetails = trelloCardDetailsSnap.exists();
    const trelloCardURLSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/trelloCardURL`)
      .once('value');
    const actualTrelloCardUrl = trelloCardURLSnap.exists();

    // Assertions
    expect(actualTrelloCardDetails).to.equal(
      false,
      'deleted card has been removed from trello integration'
    );
    expect(actualTrelloCardUrl).to.equal(
      false,
      'deleted Trello card URL from its deficient item'
    );
  });
});

describe('Deficient Items Unarchiving', () => {
  afterEach(async () => {
    await cleanDb(db);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it('should not unarchive a deficient item when archival requested', async () => {
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
    const diPath = `/archive/propertyInspectionDeficientItems/${propertyId}/${DEFICIENT_ITEM_ID}`;
    const diRef = db.ref(diPath);
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
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const actual = await db
      .ref(
        `/propertyInspectionDeficientItems/${propertyId}/${DEFICIENT_ITEM_ID}`
      )
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(
      false,
      'did not archive the deficient item'
    );
  });

  it('should unarchive a deficient item when unarchived', async () => {
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
    const diRef = db.ref(DEFICIENT_ITEM_ARCHIVE_DB_PATH);
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    });
    const beforeSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const result = await db.ref(DEFICIENT_ITEM_DB_PATH).once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(true);
  });

  it('should unarchive a deficient items trello card when requested', async () => {
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [DEFICIENT_ITEM_ID]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(
        200,
        Object.assign({}, TRELLO_API_CARD_PAYLOAD, {
          id: TRELLO_CARD_ID,
          closed: false,
        })
      );

    // Setup database
    await db.ref(`/properties/${PROPERTY_ID}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diRef = db.ref(DEFICIENT_ITEM_ARCHIVE_DB_PATH);
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      item: DEFICIENT_ITEM_ID,
    });

    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);
    await wrapped(changeSnap, {
      params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const actual = await db
      .ref(
        `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`
      )
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'archived the deficient item');
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [DEFICIENT_ITEM_ID]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await db.ref(`/properties/${PROPERTY_ID}`).set({ name: 'test' });
    await db.ref(`/inspections/${inspectionId}`).set(inspectionData); // Add inspection
    const diRef = db.ref(DEFICIENT_ITEM_ARCHIVE_DB_PATH);
    await diRef.set({
      state: 'requires-action',
      inspection: inspectionId,
      trelloCardURL: 'something',
    });
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db
      .ref(`${DEFICIENT_ITEM_ARCHIVE_DB_PATH}/archive`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);

    try {
      await wrapped(changeSnap, {
        params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Test result
    const trelloCardDetailsSnap = await db
      .ref(`${TRELLO_PROPERTY_CARDS_PATH}/${TRELLO_CARD_ID}`)
      .once('value');
    const actualTrelloCardDetails = trelloCardDetailsSnap.exists();
    const trelloCardURLSnap = await db
      .ref(`${DEFICIENT_ITEM_DB_PATH}/trelloCardURL`)
      .once('value');
    const actualTrelloCardUrl = trelloCardURLSnap.exists();

    // Assertions
    expect(actualTrelloCardDetails).to.equal(
      false,
      'deleted card has been removed from trello integration'
    );
    expect(actualTrelloCardUrl).to.equal(
      false,
      'deleted Trello card URL from its deficient item'
    );
  });
});
