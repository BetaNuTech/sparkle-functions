const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const trelloTest = require('../../../test-helpers/trello');
const deferredDiData = require('../../../test-helpers/mocks/deferred-deficient-item');
const TRELLO_PUT_CARD_RESPONSE = require('../../../test-helpers/mocks/put-trello-card.json');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../../setup');

const USER_ID = uuid();
const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const TRELLO_CARD_ID = uuid();
const TRELLO_CLOSE_LIST_ID = uuid();
const TRELLO_API_KEY = 'f4a04dd8';
const TRELLO_AUTH_TOKEN = 'fab424b6';
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_PROPERTY_DB_PATH = `/integrations/trello/properties/${PROPERTY_ID}`;
const DEFICIENT_ITEM_DB_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const DEFICIENT_ITEM_DATA = JSON.parse(JSON.stringify(deferredDiData)); // deep clone
DEFICIENT_ITEM_DATA.stateHistory['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-previous'].user = USER_ID;
DEFICIENT_ITEM_DATA.deferredDates['-current'].user = USER_ID;
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  user: uuid(),
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const TRELLO_PROPERTY_INTEGRATION_DATA = { closedList: TRELLO_CLOSE_LIST_ID };

describe('Trello Comment for Deficient Item State Updates', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should not update a trello card when closed list is unconfigured and no due date was provided', async () => {
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/closed`),
    };
    const deficientItemData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    deficientItemData.state = 'closed';
    delete deficientItemData.dueDates;
    delete deficientItemData.deferredDates;

    // Setup database
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_PROPERTY_DB_PATH).set({ openList: uuid() }); // no `closeList`

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&dueComplete=true&idList=${TRELLO_CLOSE_LIST_ID}`
      )
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.trelloDiCardClose)(pubSubMessage);

    // Assertion
    const actual = cardUpdate.isDone();
    expect(actual).to.equal(false);
  });

  it("should move a closed deficient item's trello card to the configured closed list", async () => {
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/closed`),
    };
    const deficientItemData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    deficientItemData.state = 'closed';
    delete deficientItemData.dueDates;
    delete deficientItemData.deferredDates;

    // Setup database
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_PROPERTY_DB_PATH).set(TRELLO_PROPERTY_INTEGRATION_DATA);

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&idList=${TRELLO_CLOSE_LIST_ID}`
      )
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.trelloDiCardClose)(pubSubMessage);

    // Assertion
    // Throws error if request not performed
    return cardUpdate.done();
  });

  it("should move a closed trello card to its' closed list and remove its' due date", async () => {
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/closed`),
    };
    const deficientItemData = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: 'closed',
    });

    // Setup database
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_PROPERTY_DB_PATH).set(TRELLO_PROPERTY_INTEGRATION_DATA);

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&dueComplete=true&idList=${TRELLO_CLOSE_LIST_ID}`
      )
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.trelloDiCardClose)(pubSubMessage);

    // Assertion
    // Throws error if request not performed
    return cardUpdate.done();
  });

  it("should removed a completed trello card's due date", async () => {
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/completed`),
    };
    const deficientItemData = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: 'completed',
    });

    // Setup database
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_PROPERTY_DB_PATH).set(TRELLO_PROPERTY_INTEGRATION_DATA);

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&dueComplete=true`
      )
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.trelloDiCardClose)(pubSubMessage);

    // Assertion
    // Throws error if request not performed
    return cardUpdate.done();
  });

  it('should remove old Trello card references when it detects the card has been deleted', async () => {
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/closed`),
    };
    const deficientItemData = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: 'closed',
    });
    const trelloCardData = Object.assign({}, TRELLO_CARD_DATA, {
      [uuid()]: uuid(), // Add 2nd random card reference
    });

    // Setup database
    await db.ref(TRELLO_CARDS_DB_PATH).set(trelloCardData);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_PROPERTY_DB_PATH).set(TRELLO_PROPERTY_INTEGRATION_DATA);

    // Stub Requests
    nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&dueComplete=true&idList=${TRELLO_CLOSE_LIST_ID}`
      )
      .reply(404);

    // Execute
    await test.wrap(cloudFunctions.trelloDiCardClose)(pubSubMessage);

    // Assertions
    return trelloTest.hasRemovedDiCardReferences(
      db,
      `${TRELLO_CARDS_DB_PATH}/${TRELLO_CARD_ID}`,
      DEFICIENT_ITEM_DB_PATH
    );
  });
});
