const { expect } = require('chai');
const request = require('supertest');

const getAllBoardListsAppEndpoint = require('../../trello/get-all-trello-board-lists-handler');
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
const TRELLO_BOARD_ID = '5d0ab7754066f880369a4d97';
const EMPTY_TRELLO_BOARD_ID = '5d0fcb47d665c204cb10c59f';
const TRELLO_BOARD_LIST_URL = `/integrations/trello/${PROPERTY_ID}/boards/${TRELLO_BOARD_ID}/lists`;
const TRELLO_EMPTY_BOARD_LIST_URL = `/integrations/trello/${PROPERTY_ID}/boards/${EMPTY_TRELLO_BOARD_ID}/lists`;
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}`;

describe('Trello Get All Board Lists', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(TRELLO_CREDENTIAL_DB_PATH).remove();
  });

  it('should reject request for non-existent property', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .get(TRELLO_BOARD_LIST_URL)
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
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

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
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

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
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Valid Trello credentials for property/requester
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set({
      user: USER_ID,
      apikey: TRELLO_API_KEY,
      authToken: TRELLO_AUTH_TOKEN,
    });

    // Execute & Get Result
    const app = getAllBoardListsAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .get(TRELLO_EMPTY_BOARD_LIST_URL)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);
  });

  it("should respond successfully with any discovered trello board's lists", async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

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

    // Assertions
    expect(result.body.data).to.deep.equal([
      {
        type: 'trello-list',
        id: '5d0ab7754066f880369a4d98',
        attributes: {
          name: 'Icebox',
        },
      },
      {
        type: 'trello-list',
        id: '5d0ab7754066f880369a4d99',
        attributes: {
          name: 'Pending',
        },
      },
      {
        type: 'trello-list',
        id: '5d0ab7754066f880369a4d9a',
        attributes: {
          name: 'WIP (Work in progress) ',
        },
      },
      {
        type: 'trello-list',
        id: '5d0ab7754066f880369a4d9b',
        attributes: {
          name: 'Review',
        },
      },
      {
        type: 'trello-list',
        id: '5d0ab7754066f880369a4d9c',
        attributes: {
          name: 'Done',
        },
      },
    ]);
  });
});
