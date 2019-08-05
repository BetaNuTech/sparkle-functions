const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const getAllBoardsAppEndpoint = require('../../trello/get-all-trello-boards-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const allTrelloBoardsPayload = require('../../test-helpers/mocks/get-all-trello-boards.json');

const PROPERTY_ID = uuid();
const PROPERTY_DATA = { name: `name${PROPERTY_ID}` };
const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;

describe('Trello Get All Boards', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject request for non-existent property', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);

    // Assertions
    expect(result.body.message).to.equal('invalid propertyId');
  });

  it('should reject a non-admin requester with an unauthorized response', async function() {
    const userId2 = uuid();

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set({ admin: false, corporate: true }); // add non-admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
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
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Another user's Trello crendientials
    await db
      .ref(TRELLO_CREDENTIAL_DB_PATH)
      .set({ user: userId2, apikey: '123', authToken: '123' });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
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
      .get('/1/members/me/boards?key=123&token=123')
      .reply(401, 'invalid key');

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    await db
      .ref(TRELLO_CREDENTIAL_DB_PATH)
      .set({ user: USER_ID, apikey: '123', authToken: '123' }); // create intregration that will throw 4xx error from trello api (invalid api key)

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('Error from trello API');
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
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Valid trello credentials
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);
  });

  it('should respond successfully with any discovered trello boards', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(
        `/1/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, allTrelloBoardsPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Valid trello credentials
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(`/integrations/trello/${PROPERTY_ID}/boards`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);
    const actual = result.body.data;

    // Assertions
    expect(actual.length).to.equal(
      allTrelloBoardsPayload.length,
      'resolved all payload records'
    );
    expect(actual.every(({ type }) => type === 'trello-board')).to.equal(
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
