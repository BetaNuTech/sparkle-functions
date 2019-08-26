const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const trelloTest = require('../../test-helpers/trello');
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
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN = 'fab424b6f18b2845b3d60eac800e42e5264b';
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const DEFICIENT_ITEM_DB_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const DEFICIENT_ITEM_DATA = {
  createdAt: 1565660497.888,
  updatedAt: 1565660497.888,
  inspection: 'Lm7chlG1',
  item: '772iwJ',
  currentDueDate: 1567141200,
  currentDueDateDay: '08/30/2019',
  itemDataLastUpdatedDate: 1565660497.888,
  itemInspectorNotes: 'Yyy',
  itemMainInputSelection: 2,
  itemMainInputType: 'threeactions_abc',
  itemTitle: 'Blah',
  sectionTitle: 'Test',
  sectionType: 'single',
  state: 'deferred', // transitioned from requires-action to deferred
  trelloCardURL: 'https://trello.com/c/dzRVzG5n',
  stateHistory: {
    '-23lak': {
      state: 'deferred',
      user: USER_ID,
      createdAt: 1565660497.888,
    },
  },
  dueDates: {
    '-234fkd': {
      startDate: 1565660497.888,
      dueDate: 1567141200,
      user: USER_ID,
      createdAt: 1565660497.888,
    },
    '-Zf6Uiv': {
      startDate: 1565660497.888,
      dueDate: 1567141200,
      user: USER_ID,
      createdAt: 1565540496.888,
    },
  },
  deferredDates: {
    '-98dakj': {
      deferredDate: 1567141200,
      user: USER_ID,
      createdAt: 1565660497.888,
    },
  },
};
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
