const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const diModel = require('../../../models/deficient-items');
const archiveModel = require('../../../models/_internal/archive');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const {
  db,
  fs,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../../setup');

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

describe('Deficient Items | Firestore | Archiving', () => {
  afterEach(async () => {
    await cleanDb(db, fs);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it('should not archive a deficient item when not in archive mode', async () => {
    const expected = false;
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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, {
      name: 'test',
    });
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
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diModel.updateRecord(db, fs, propertyId, deficientItemId, {
      archive: false,
      ...deficientItem,
    });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId },
    });

    // Test result
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficientItemId
    );
    const actual = Boolean(result && result.exists);

    // Assertions
    expect(actual).to.equal(expected, 'did not archive the deficient item');
  });

  it('should archive a deficient item when archive mode activated', async () => {
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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, {
      name: 'test',
    });
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
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diModel.updateRecord(db, fs, propertyId, deficientItemId, {
      archive: true,
      ...deficientItem,
    });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);
    await wrapped(changeSnap, {
      params: { propertyId, deficientItemId },
    });

    // Test result
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficientItemId
    );
    const actual = result ? result.exists : null;

    // Assertions
    const expected = true;
    expect(actual).to.equal(expected, 'archived the deficient item');
  });

  it('should remove old Trello card references from archive when card has been deleted', async () => {
    const inspectionId = uuid();
    const itemId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: 'something',
    };

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, {
      name: 'test',
    });
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const diPath = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
    await db.ref(diPath).set(deficientItem);
    await diModel.firestoreCreateRecord(fs, DEFICIENT_ITEM_ID, {
      property: PROPERTY_ID,
      ...deficientItem,
    });
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diModel.updateRecord(db, fs, PROPERTY_ID, DEFICIENT_ITEM_ID, {
      archive: true,
      ...deficientItem,
    });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchiving);

    try {
      await wrapped(changeSnap, {
        params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Test Results
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      DEFICIENT_ITEM_ID
    );
    const { exists } = result;
    const actual = (result ? result.data() : {}).trelloCardURL;

    // Assertions
    expect(exists).to.equal(true);
    expect(actual).to.equal(undefined);
  });
});

describe('Deficient Items Unarchiving', () => {
  afterEach(async () => {
    await cleanDb(db, fs);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it('should keep a deficient item in archive while in archive mode', async () => {
    const itemId = uuid();
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, {
      name: 'test',
    });
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection

    const diRef = await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_ID,
      deficientItem
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      DEFICIENT_ITEM_ID,
      {
        property: PROPERTY_ID,
        ...deficientItem,
      }
    );
    const diPath = diRef.path.toString();
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: true });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);
    await wrapped(changeSnap, {
      params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const expected = false;
    const result = await diModel.firestoreFindRecord(fs, DEFICIENT_ITEM_ID);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected, 'did not archive the deficient item');
  });

  it('should move a deficient item out of archive when archive mode turned off', async () => {
    const inspectionId = uuid();
    const itemId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,

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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, {
      name: 'test',
    });
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection

    const diRef = await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_ID,
      deficientItem
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      DEFICIENT_ITEM_ID,
      {
        property: PROPERTY_ID,
        ...deficientItem,
      }
    );
    const diPath = diRef.path.toString();
    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);
    await wrapped(changeSnap, {
      params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
    });

    // Test result
    const expected = true; // exists
    const result = await diModel.firestoreFindRecord(fs, DEFICIENT_ITEM_ID);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const itemId = uuid();
    const inspectionId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: PROPERTY_ID,
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
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: 'something',
    };

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, PROPERTY_ID, {
      name: 'test',
    });
    await inspectionsModel.realtimeUpsertRecord(
      db,
      inspectionId,
      inspectionData
    ); // Add inspection
    const diRef = await archiveModel.deficientItem.realtimeCreateRecord(
      db,
      PROPERTY_ID,
      DEFICIENT_ITEM_ID,
      deficientItem
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      DEFICIENT_ITEM_ID,
      {
        property: PROPERTY_ID,
        ...deficientItem,
      }
    );
    const diPath = diRef.path.toString();
    await db
      .ref(TRELLO_PROPERTY_CARDS_PATH)
      .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    const beforeSnap = await db.ref(`${diPath}/archive`).once('value'); // Create before
    await diRef.update({ archive: false });
    const afterSnap = await db.ref(`${diPath}/archive`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchiving);

    try {
      await wrapped(changeSnap, {
        params: { propertyId: PROPERTY_ID, deficientItemId: DEFICIENT_ITEM_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Test Results
    const result = await diModel.firestoreFindRecord(fs, DEFICIENT_ITEM_ID);
    const { exists } = result;
    const actual = (result ? result.data() : {}).trelloCardURL;

    // Assertions
    expect(exists).to.equal(true);
    expect(actual).to.equal(undefined);
  });
});
