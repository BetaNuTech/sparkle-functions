const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const getAllBoardListsAppEndpoint = require('../../trello/get-all-trello-board-lists-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const allTrelloBoardListsPayload = require('../../test-helpers/mocks/get-all-trello-board-lists.json');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const TRELLO_BOARD_ID = '5d0ab7754066f880369a4d97';
const TRELLO_BOARD_LIST_URL = `/integrations/trello/boards/${TRELLO_BOARD_ID}/lists`;
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;

describe('Trello Get All Board Lists', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject a non-admin requester with an unauthorized response', async function() {
    const userId2 = uuid();

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set({ admin: false, corporate: true }); // add non-admin user

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .get(TRELLO_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return unauthorized response when requesting user does did not provide stored credentials', async function() {
    const userId2 = uuid();

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Invalid Trello credentials for requestor
    await db
      .ref(TRELLO_CREDENTIAL_DB_PATH)
      .set({ user: userId2, apikey: '123', authToken: '123' });

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(TRELLO_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal(
      'This user never created this auth token'
    );
  });

  it('should relay a bad request response from the Trello API', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(`/1/boards/${TRELLO_BOARD_ID}/lists?key=123&token=123`)
      .reply(401, 'invalid key');

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Invalid Trello apiKey & authToken
    await db
      .ref(TRELLO_CREDENTIAL_DB_PATH)
      .set({ user: USER_ID, apikey: '123', authToken: '123' });

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(TRELLO_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('Error from trello API');
  });

  it('should return an unfound response when trello member has no boards', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, []);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Valid Trello credentials for property/requester
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .get(TRELLO_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);
  });

  it("should respond successfully with any discovered trello board's lists", async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/boards/${TRELLO_BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, allTrelloBoardListsPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Valid Trello credentials for property/requstor
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(TRELLO_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);
    const actual = result.body.data;

    // Assertions
    expect(actual.length).to.equal(
      allTrelloBoardListsPayload.length,
      'resolved all payload records'
    );
    expect(actual.every(({ type }) => type === 'trello-list')).to.equal(
      true,
      'set resource type on payloads'
    );
    expect(actual.every(({ id }) => Boolean(id))).to.equal(
      true,
      'set resource id on payloads'
    );
    expect(actual.every(({ attributes }) => Boolean(attributes))).to.equal(
      true,
      'set JSON-API attributes'
    );
  });
});
