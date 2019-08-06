const { expect } = require('chai');
const request = require('supertest');
const getTrelloAuthorizorApp = require('../../trello/get-trello-authorizor-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const EXPECTED_JSON_PAYLOAD = require('../../test-helpers/mocks/get-trello-authorizor-payload.json');

const USER_ID = EXPECTED_JSON_PAYLOAD.data.id;
const USER = {
  firstName: EXPECTED_JSON_PAYLOAD.data.attributes.firstName,
  lastName: EXPECTED_JSON_PAYLOAD.data.attributes.lastName,
  email: EXPECTED_JSON_PAYLOAD.data.attributes.email,
  admin: true,
  corporate: true,
};
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CREDENTIALS_DATA = {
  member: EXPECTED_JSON_PAYLOAD.data.attributes.trelloMember,
  trelloUsername: EXPECTED_JSON_PAYLOAD.data.attributes.trelloUsername,
  authToken: '1234',
  apikey: '1234',
  user: EXPECTED_JSON_PAYLOAD.data.id,
};

describe('Trello Get Authorizor', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject a non-admin requester', async function() {
    const userId2 = uuid();

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set({ admin: false, corporate: true }); // add non-admin user

    // Execute & Get Result
    const app = getTrelloAuthorizorApp(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .get('/integrations/trello')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return an empty response when trello credentials are not set', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = getTrelloAuthorizorApp(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get('/integrations/trello')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    expect(result.body.data).to.deep.equal({}, 'has no user data');
  });

  it('should return a populated response when trello credentials are set', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_CREDENTIALS_DATA);

    // Execute & Get Result
    const app = getTrelloAuthorizorApp(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get('/integrations/trello')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    expect(result.body).to.deep.equal(EXPECTED_JSON_PAYLOAD);
  });
});
