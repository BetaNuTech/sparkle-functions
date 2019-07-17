const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const createTrelloDeficientItemCardHandler = require('../../trello/create-trello-deficient-item-card-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const trelloCardPayload = require('../../test-helpers/mocks/get-trello-card.json');

const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const INSPECTION_ID = uuid();
const ITEM_ID = uuid();
const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_MEMBER_ID = '57c864cb46ef602b2be03a80';
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const TRELLO_BOARD_ID = '5d0ab7754066f880369a4d97';
const TRELLO_LIST_ID = '5d0ab7754066f880369a4d99';
const API_PATH = `/properties/${PROPERTY_ID}/deficient-items/${DEFICIENT_ITEM_ID}/trello/card`;
const DEFICIENT_ITEM_DATA = {
  createdAt: Date.now() / 1000,
  currentDueDate: Date.now() / 1000,
  currentDueDateDay: '01/15/2025',
  itemTitle: 'Broken Pipe',
  itemScore: 4,
  itemInspectorNotes: 'a lot of rust around pipe',
  currentPlanToFix: 'replace pipe completely',
  inspection: INSPECTION_ID,
  item: ITEM_ID,
};
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  member: TRELLO_MEMBER_ID,
  user: USER_ID,
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const INSPECTION_ITEM_DATA = {
  mainInputFourValue: 0,
  mainInputOneValue: 2,
  mainInputThreeValue: 3,
  mainInputTwoValue: 0,
  mainInputZeroValue: 1,
};
const INTEGRATIONS_DATA = {
  grantedBy: USER_ID,
  grantedAt: Date.now() / 1000,
  board: TRELLO_BOARD_ID,
  boardName: 'Test Board',
  list: TRELLO_LIST_ID,
  listName: 'TO DO',
};
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}`;
const TRELLO_INTEGRATIONS_DB_PATH = `/integrations/trello/properties/${PROPERTY_ID}`;

describe('Trello Create Deficient Item Cards', () => {
  afterEach(async () => {
    await cleanDb(db);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).remove();
    return db.ref(TRELLO_INTEGRATIONS_DB_PATH).remove();
  });

  it('should send forbidden error when property has no trello auth credentials', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db
      .ref(
        `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`
      )
      .set(DEFICIENT_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID)
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(403);

    // Assertions
    expect(result.body.message).to.equal('Error accessing trello token');
  });

  it('should return conflict error when requested deficient item does not exist', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID)
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Requested property or deficient item could not be found'
    );
  });

  it('should return conflict error when no trello board and/or list is configured for property', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(
        `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`
      )
      .set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID)
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Trello integration details for property not found or invalid'
    );
  });

  it('should return an error when attempting to create duplicate cards', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(
      Object.assign({}, TRELLO_SYSTEM_INTEGRATION_DATA, {
        cards: { 'trello-card-id': DEFICIENT_ITEM_ID },
      })
    );
    await db
      .ref(
        `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`
      )
      .set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID)
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Deficient Item already has published Trello Card'
    );
  });

  it('should succesfully create a trello card for the deficient item with expected details', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(
        `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`
      )
      .set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID)
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    const trelloIntegrationSnap = await db
      .ref(TRELLO_CREDENTIAL_DB_PATH)
      .once('value');

    const trelloIntegration = trelloIntegrationSnap.val();
    // Assertions
    Object.keys(trelloIntegration.cards).forEach(trelloCardId => {
      expect(trelloIntegration.cards[trelloCardId]).to.equal(DEFICIENT_ITEM_ID);
    });

    expect(result.body.message).to.equal('successfully created trello card');
  });
});
