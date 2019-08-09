const { expect } = require('chai');
const request = require('supertest');
const deleteTrelloAuthApp = require('../../trello/delete-trello-auth-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

// const USER_ID = uuid();
// const PROPERTY_ID = uuid();
// const USER_DATA = {
//   firstName: 'mr',
//   lastName: 'testor',
//   email: 'test@gmail.com',
//   admin: true,
//   corporate: false,
// };
const API_PATH = '/integrations/trello/authorization';
// const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
// const TRELLO_INTEGRATIONS_DB_PATH = `/integrations/trello/properties/${PROPERTY_ID}`;
// const TRELLO_CREDENTIALS_DATA = {
//   member: 'akdf2334fasd',
//   trelloUsername: 'jakew4',
//   authToken: '1234dfasqruolfkj',
//   apikey: '1234dlkfjasdlf',
//   user: USER_ID,
// };

describe('Trello Delete Authorization', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject non-admin requester with an unauthorized response', async function() {
    const unauthUserId = uuid();

    // Setup database
    await db
      .ref(`/users/${unauthUserId}`)
      .set({ admin: false, corporate: true }); // add non-admin user

    // Execute & Get Result
    const app = deleteTrelloAuthApp(db, stubFirbaseAuth(unauthUserId));
    const result = await request(app)
      .delete(API_PATH)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });
});
