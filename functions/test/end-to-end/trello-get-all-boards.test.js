const { expect } = require('chai');
const request = require('supertest');

const getAllBoardsAppEndpoint = require('../../trello/get-all-trello-boards-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

const PROPERTY_ID = uuid();
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
};

const USER_ID = uuid();
const USER = { admin: true, corporate: true };

const TRELLO_API_KEY = 'f4a04dd872b7a2e33bfc33aac9516965';
const TRELLO_AUTH_TOKEN =
  'fab424b6f18b2845b3d60eac800e42e5f3ab2fdb25d21c90264032a0ecf16ceb';

const TRELLO_API_KEY_WITHOUT_CONTENT = '9fbc5188392b34f4f6ced30138a0d219';
const TRELLO_AUTH_TOKEN_WITHOUT_CONTENT =
  'f163d4004e688512382909e5c72b83cf9bb991f8f6c76cc165f54f8267c625b7';

const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}`;

describe('Trello Get All Boards', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(TRELLO_CREDENTIAL_DB_PATH).remove();
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

  it('should notify requesting user of a bad request to Trello API', async function() {
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
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Valid trello credentials
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY_WITHOUT_CONTENT,
      authToken: TRELLO_AUTH_TOKEN_WITHOUT_CONTENT,
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

    // Assertions
    expect(result.body.data).to.deep.equal([
      {
        type: 'trello-board',
        id: '5d0fcb47d665c204cb10c59f',
        attributes: {
          name: 'Empty Board',
        },
      },
      {
        type: 'trello-board',
        id: '5d0ab7754066f880369a4d97',
        attributes: {
          name: 'Project Manager Sample Board',
        },
      },
    ]);
  });
});
