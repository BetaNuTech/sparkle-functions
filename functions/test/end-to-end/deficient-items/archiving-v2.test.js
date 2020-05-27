const { expect } = require('chai');
const nock = require('nock');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const trelloTest = require('../../../test-helpers/trello');
const diModel = require('../../../models/deficient-items');
const archiveModel = require('../../../models/_internal/archive');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const TRELLO_API_CARD_PAYLOAD = require('../../../test-helpers/mocks/get-trello-card.json');
const {
  db,
  fs,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../../setup');

const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const DEFICIENT_COLLECTION = config.deficientItems.collection;
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

describe('Deficient Items | Archiving | V2', () => {
  afterEach(async () => {
    await cleanDb(db, fs);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it("should not archive a deficient item when its' archive is set to false", async () => {
    const expected = null;
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const beforeSnap = await diModel.firestoreFindRecord(fs, deficiencyId);
    await diModel.firestoreUpdateRecord(fs, deficiencyId, { archive: false });
    const afterSnap = await diModel.firestoreFindRecord(fs, deficiencyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchivingV2);
    await wrapped(changeSnap, {
      params: { deficiencyId },
    });

    // Test result
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    const actual = result.data() || null;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should archive a deficient item when its' archive is set to true", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };
    const expected = {
      ...deficiencyData,
      archive: true,
      _collection: DEFICIENT_COLLECTION,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    const beforeSnap = await diModel.firestoreFindRecord(fs, deficiencyId);
    await diModel.firestoreUpdateRecord(fs, deficiencyId, { archive: true });
    const afterSnap = await diModel.firestoreFindRecord(fs, deficiencyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchivingV2);
    await wrapped(changeSnap, {
      params: { deficiencyId },
    });

    // Test result
    const result = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    const actual = result.data() || null;

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should request to archive an archived deficient items' trello card", async () => {
    const expected = true;
    const propertyId = PROPERTY_ID;
    const deficiencyId = DEFICIENT_ITEM_ID;
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
          [uuid()]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });
    const propertyData = { name: 'test' };

    // Stub Requests
    const trelloApi = nock('https://api.trello.com')
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
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    await createTrelloCardDiSystemRecord();
    const beforeSnap = await diModel.firestoreFindRecord(fs, deficiencyId);
    await diModel.firestoreUpdateRecord(fs, deficiencyId, { archive: true });
    const afterSnap = await diModel.firestoreFindRecord(fs, deficiencyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchivingV2);
    await wrapped(changeSnap, {
      params: { deficiencyId },
    });

    // Test result
    const actual = trelloApi.isDone();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const propertyId = PROPERTY_ID;
    const deficiencyId = DEFICIENT_ITEM_ID;
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: '/card/url',
    };

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficiencyData);
    await createTrelloCardDiSystemRecord();
    const beforeSnap = await diModel.firestoreFindRecord(fs, deficiencyId);
    await diModel.firestoreUpdateRecord(fs, deficiencyId, { archive: true });
    const afterSnap = await diModel.firestoreFindRecord(fs, deficiencyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsArchivingV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Assertions
    // TODO: Replace with fireabase record assertions
    return trelloTest.hasRemovedDiCardReferences(
      db,
      `${TRELLO_PROPERTY_CARDS_PATH}/${TRELLO_CARD_ID}`,
      DEFICIENT_ITEM_ARCHIVE_DB_PATH
    );
  });
});

describe('Deficient Items | Unarchiving | V2', () => {
  afterEach(async () => {
    await cleanDb(db, fs);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it('should not unarchive a deficient item when archival requested', async () => {
    const expected = null;
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    const beforeSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    await archiveModel.deficientItem.firestoreUpdateRecord(fs, deficiencyId, {
      archive: true,
    });
    const afterSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchivingV2);
    await wrapped(changeSnap, {
      params: { deficiencyId },
    });

    // Test result
    const result = await diModel.firestoreFindRecord(fs, deficiencyId);
    const actual = result.data() || null;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should unarchive a deficient item when unarchived', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    };
    const expected = {
      ...deficiencyData,
      archive: false,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    const beforeSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    await archiveModel.deficientItem.firestoreUpdateRecord(fs, deficiencyId, {
      archive: false,
    });
    const afterSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchivingV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test result
    const result = await diModel.firestoreFindRecord(fs, deficiencyId);
    const actual = result.data() || null;

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should request to unarchive a deficient item's trello card", async () => {
    const expected = true;
    const inspectionId = uuid();
    const propertyId = PROPERTY_ID;
    const deficiencyId = DEFICIENT_ITEM_ID;
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
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
    const trelloApi = nock('https://api.trello.com')
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: DEFICIENT_ITEM_ID,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    await createTrelloCardDiSystemRecord();
    const beforeSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    await archiveModel.deficientItem.firestoreUpdateRecord(fs, deficiencyId, {
      archive: false,
    });
    const afterSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchivingV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test result
    const actual = trelloApi.isDone();

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const inspectionId = uuid();
    const itemId = uuid();
    const propertyId = PROPERTY_ID;
    const deficiencyId = DEFICIENT_ITEM_ID;
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
    const propertyData = { name: 'test' };
    const deficiencyData = {
      state: 'requires-action',
      inspection: inspectionId,
      item: itemId,
      property: propertyId,
      trelloCardURL: '/card/url',
    };

    // Stub requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(404);

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData);
    await inspectionsModel.firestoreCreateRecord(
      fs,
      inspectionId,
      inspectionData
    );
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    await createTrelloCardDiSystemRecord();
    const beforeSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );
    await archiveModel.deficientItem.firestoreUpdateRecord(fs, deficiencyId, {
      archive: false,
    });
    const afterSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficiencyId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsUnarchivingV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Assertions
    // TODO replace with firestore record assertions
    return trelloTest.hasRemovedDiCardReferences(
      db,
      `${TRELLO_PROPERTY_CARDS_PATH}/${TRELLO_CARD_ID}`,
      DEFICIENT_ITEM_DB_PATH
    );
  });
});

async function createTrelloCardDiSystemRecord() {
  await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
  await db
    .ref(TRELLO_PROPERTY_CARDS_PATH)
    .set(TRELLO_SYSTEM_PROPERTY_CARDS_DATA);
  await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
}
