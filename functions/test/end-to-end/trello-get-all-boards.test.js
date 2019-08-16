const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const getAllBoardsAppEndpoint = require('../../trello/get-all-trello-boards-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const TRELLO_BOARDS_PAYLOAD = require('../../test-helpers/mocks/get-all-trello-board-lists.json');
const TRELLO_ORGS_PAYLOAD = require('../../test-helpers/mocks/get-trello-member-organizations.json');
const EXPECTED_PAYLOAD = require('../../test-helpers/mocks/get-all-trello-boards-payload.json');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const TRELLO_MEMBER_ID = '57r162cc46ed502b2be03q80';
const TRELLO_BOARD_ID = TRELLO_BOARDS_PAYLOAD[0].id;
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;

// Ensure Trello board exists in orgs
TRELLO_ORGS_PAYLOAD[0].idBoards.push(TRELLO_BOARD_ID);

describe('Trello Get All Boards', () => {
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
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .get('/integrations/trello/boards')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should relay a bad request response from the Trello API', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get('/1/members/me/boards?key=123&token=123')
      .reply(401, 'invalid key');

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      memeber: TRELLO_MEMBER_ID,
      apikey: '123', // invalid
      authToken: '123', // invalid
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get('/integrations/trello/boards')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('Error from trello API member boards');
  });

  it('should return unfound response when trello member has no boards', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, []);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Valid trello credentials
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      memeber: TRELLO_MEMBER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .get('/integrations/trello/boards')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);
  });

  it('should respond successfully with any discovered trello boards and organizations', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, TRELLO_BOARDS_PAYLOAD);
    nock('https://api.trello.com')
      .get(
        `/1/members/${TRELLO_MEMBER_ID}/organizations?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&limit=1000`
      )
      .reply(200, TRELLO_ORGS_PAYLOAD);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      member: TRELLO_MEMBER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get('/integrations/trello/boards')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);
    const actual = result.body;

    // Assertions
    expect(actual.data.length).to.equal(
      TRELLO_BOARDS_PAYLOAD.length,
      'resolved all board records'
    );
    expect(actual.included.length).to.equal(
      TRELLO_ORGS_PAYLOAD.length,
      'resolved all organization records'
    );
    expect(actual).to.deep.equal(EXPECTED_PAYLOAD);
  });

  it('should allow an admin user that did did not provide Trello credentials to request boards', async () => {
    const userId2 = uuid();

    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, TRELLO_BOARDS_PAYLOAD);
    nock('https://api.trello.com')
      .get(
        `/1/members/${TRELLO_MEMBER_ID}/organizations?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&limit=1000`
      )
      .reply(200, TRELLO_ORGS_PAYLOAD);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set(USER); // add requesting admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      member: TRELLO_MEMBER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(userId2));
    await request(app)
      .get('/integrations/trello/boards')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);
  });
});
