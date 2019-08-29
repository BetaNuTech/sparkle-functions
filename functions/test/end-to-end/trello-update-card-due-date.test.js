const nock = require('nock');
const moment = require('moment');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const appConfig = require('../../config');
const { cleanDb } = require('../../test-helpers/firebase');
const deferredDiData = require('../../test-helpers/mocks/deferred-deficient-item');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('./setup');

const USER_ID = uuid();
const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const TRELLO_CARD_ID = uuid();
const TRELLO_API_KEY = 'f4a04dd8';
const TRELLO_AUTH_TOKEN = 'fab424b6';
const OVERDUE_DI_STATES = appConfig.deficientItems.overdueEligibleStates;
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const DEFICIENT_ITEM_DB_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const DEFICIENT_ITEM_DATA = Object.assign({}, deferredDiData);
DEFICIENT_ITEM_DATA.stateHistory['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-previous'].user = USER_ID;
DEFICIENT_ITEM_DATA.deferredDates['-current'].user = USER_ID;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  member: uuid(),
  user: uuid(),
  trelloUsername: 'username',
  trelloEmail: 'test@gmail.com',
  trelloFullName: 'full name',
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const USER_DATA = {
  admin: true,
  corporate: false,
  email: 'testor@bluestone-prop.com',
  firstName: 'Test',
  lastName: 'User',
};

describe('Trello Card Due Date Updates', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it("should update a trello cards due date when a deficient item's due date changes", async () => {
    const expected = '2030-08-08T23:59:00.000Z';
    const expectedDate = '08/08/2030';
    const updatedState = OVERDUE_DI_STATES[0]; // pending
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${updatedState}`
      ),
    };
    const timestamp = Date.now() / 1000;
    const deficientItemData = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: updatedState,
      currentDueDateDay: expectedDate,
    });
    deficientItemData.updatedAt = timestamp;
    deficientItemData.dueDates['-current'].createdAt = timestamp;

    // Setup database
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);

    // Stub Requests
    nock('https://api.trello.com')
      .filteringPath(/text=[^&]*/g, 'text=test')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(201, {});

    const updatedDueDate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&due=${encodeURIComponent(
          expected
        )}`
      )
      .reply(200, {});

    // Execute
    await test.wrap(cloudFunctions.trelloCardDueDateUpdates)(pubSubMessage);

    const actual = updatedDueDate.isDone();
    expect(actual).to.equal(true);
  });

  it("should update a trello card due date a newly deferred deficient item's deferred date", async () => {
    const expected = '2030-09-09T23:59:00.000Z';
    const expectedUnix = moment(expected).unix();
    const pubSubMessage = {
      data: Buffer.from(`${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/deferred`),
    };
    const timestamp = Date.now() / 1000;
    const deficientItemData = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: 'deferred',
      currentDueDateDay: null,
    });
    deficientItemData.updatedAt = timestamp;
    deficientItemData.dueDates['-current'].createdAt = 1;
    deficientItemData.deferredDates['-current'] = {
      createdAt: timestamp,
      deferredDate: expectedUnix, // 1912481940,
      user: USER_ID,
    };

    // Setup database
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(deficientItemData);

    // Stub Requests
    nock('https://api.trello.com')
      .filteringPath(/text=[^&]*/g, 'text=test')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(201, {});

    const updatedDueDate = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&due=${encodeURIComponent(
          expected
        )}`
      )
      .reply(200, {});

    // Execute
    await test.wrap(cloudFunctions.trelloCardDueDateUpdates)(pubSubMessage);

    const actual = updatedDueDate.isDone();
    expect(actual).to.equal(true);
  });
});
