const { expect } = require('chai');
const request = require('supertest');
const getTrelloAuthorizorApp = require('../../trello/get-trello-authorizor-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
// const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
// const TRELLO_AUTH_TOKEN = 'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';
// const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;

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
    expect(result.body.includes).to.deep.equal([], 'has no side loaded data');
  });
});
