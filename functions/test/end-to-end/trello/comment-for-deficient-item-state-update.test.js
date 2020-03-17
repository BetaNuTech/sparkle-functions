const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const trelloTest = require('../../../test-helpers/trello');
const deferredDiData = require('../../../test-helpers/mocks/deferred-deficient-item');
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
const TRELLO_API_KEY = 'f4a04dd8';
const TRELLO_AUTH_TOKEN = 'fab424b6';
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const DEFICIENT_ITEM_DB_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const DEFICIENT_ITEM_DATA = JSON.parse(JSON.stringify(deferredDiData));
DEFICIENT_ITEM_DATA.stateHistory['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-previous'].user = USER_ID;
DEFICIENT_ITEM_DATA.deferredDates['-current'].user = USER_ID;
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  user: uuid(),
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

describe('Trello Comment for Deficient Item State Updates', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should not create comment when Trello credentials are not setup', async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Setup database
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);

    // Stub Requests
    const commentCreated = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(200, {});

    // Execute
    await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdates)(
      pubSubMessage
    );

    // Assertions
    const actual = commentCreated.isDone();
    expect(actual).to.equal(false);
  });

  it('should not create comment when Trello card does not exist for Deficient Item', async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Setup database
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);

    // Stub Requests
    const commentCreated = nock('https://api.trello.com')
      .put(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(200, {});

    // Execute
    await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdates)(
      pubSubMessage
    );

    const actual = commentCreated.isDone();
    expect(actual).to.equal(false);
  });

  it("should append state transition comment to a deficient items' Trello card", async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Setup database
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);

    // Stub Requests
    const commentCreated = nock('https://api.trello.com')
      .filteringPath(/text=[^&]*/g, 'text=test')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(201, {});

    // Execute
    await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdates)(
      pubSubMessage
    );

    const actual = commentCreated.isDone();
    expect(actual).to.equal(true);
  });

  it("should not escape any characters of a new state transition comment for a deficient items' Trello card", async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Stub Requests
    nock('https://api.trello.com')
      .post(uri => {
        const actual = decodeURIComponent(uri).search(/&[#a-z0-9]+;/g);
        expect(actual).to.equal(-1, 'found HTML symbol in payload');
        return uri;
      })
      .reply(201, {});

    // Setup database
    const backToPendingDI = Object.assign({}, DEFICIENT_ITEM_DATA, {
      state: 'pending',
      currentPlanToFix: `I'll test`,
    });
    backToPendingDI.stateHistory['-current'].state = 'pending';
    const older = backToPendingDI.stateHistory['-current'].createdAt - 1000;
    backToPendingDI.stateHistory['-previous'] = {
      state: 'go-back',
      user: '-1',
      createdAt: older,
    };
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(backToPendingDI);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);

    // Execute
    await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdates)(
      pubSubMessage
    );
  });

  it('should cleanup Trello card references when Trello API cannot find card for comment', async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Setup database
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_DB_PATH).set(TRELLO_CARD_DATA);
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);

    // Stub Requests
    nock('https://api.trello.com')
      .filteringPath(/text=[^&]*/g, 'text=test')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
      )
      .reply(404);

    // Execute
    try {
      await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdates)(
        pubSubMessage
      );
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    return trelloTest.hasRemovedDiCardReferences(
      db,
      `${TRELLO_CARDS_DB_PATH}/${TRELLO_CARD_ID}`,
      DEFICIENT_ITEM_DB_PATH
    );
  });
});
