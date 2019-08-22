const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const config = require('../../config');
const { cleanDb } = require('../../test-helpers/firebase');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('./setup');

const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const TRELLO_CARD_ID = uuid();
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN = 'fab424b6f18b2845b3d60eac800e42e5264b';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const DEFICIENT_ITEM_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const DEFICIENT_ITEM_DATA = {
  createdAt: 1565660497.888,
  updatedAt: 1565660497.888,
  inspection: 'Lm7chlG1',
  item: '772iwJ',
  itemDataLastUpdatedDate: 1565660497.888,
  itemInspectorNotes: 'Yyy',
  itemMainInputSelection: 2,
  itemMainInputType: 'threeactions_abc',
  itemTitle: 'Blah',
  sectionTitle: 'Test',
  sectionType: 'single',
  state: REQUIRED_ACTIONS_VALUES[1],
  trelloCardURL: 'https://trello.com/c/dzRVzG5n',
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

describe('Trello Comment for Deficient Item State Updates', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(db);
  });

  it('should not create comment when Trello credentials are not setup', async () => {
    const pubSubMessage = {
      data: Buffer.from(
        `${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/state/${DEFICIENT_ITEM_DATA.state}`
      ),
    };

    // Setup database
    await db.ref(DEFICIENT_ITEM_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(TRELLO_CARDS_DB_PATH)
      .set({ [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID });

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
    await db.ref(DEFICIENT_ITEM_PATH).set(DEFICIENT_ITEM_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);

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

  // it('should cleanup Trello card references when Trello API cannot find card for comment', async () => {});
});
