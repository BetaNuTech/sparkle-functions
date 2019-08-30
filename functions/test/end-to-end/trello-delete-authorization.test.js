const { expect } = require('chai');
const request = require('supertest');
const deleteTrelloAuthApp = require('../../trello/delete-trello-auth-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

const USER_ID = uuid();
const PROPERTY_ONE_ID = uuid();
const PROPERTY_TWO_ID = uuid();
const USER_DATA = {
  firstName: 'mr',
  lastName: 'testor',
  email: 'test@gmail.com',
  admin: true,
  corporate: false,
};
const API_PATH = '/integrations/trello/authorization';
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_INTEGRATIONS_DB_PATH_ONE = `/integrations/trello/properties/${PROPERTY_ONE_ID}`;
const TRELLO_INTEGRATIONS_DB_PATH_TWO = `/integrations/trello/properties/${PROPERTY_TWO_ID}`;
const TRELLO_INTEGRATIONS_ORG_DB_PATH = `/integrations/trello/organization`;
const TRELLO_CREDENTIALS_DATA = {
  authToken: '1234dfasqruolfkj',
  apikey: '1234dlkfjasdlf',
  user: USER_ID,
};
const TRELLO_INTEGRATION_ORG_DATA = {
  member: 'akdf2334fasd',
  trelloUsername: 'jakew4',
};
const PROPERTY_INTEGRATIONS_DATA = {
  grantedBy: USER_ID,
  grantedAt: Date.now() / 1000,
  openBoard: 'dlkfjasdlkf',
  openBoardName: 'Test Board',
  openList: 'dflajsdflkjsd',
  opentListName: 'TO DO',
};

describe('Trello Delete Authorization', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject non-admin requester with an unauthorized response', async () => {
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

  it('should remove trello credentials for the organization', async () => {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_CREDENTIALS_DATA);

    // Execute
    const app = deleteTrelloAuthApp(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .delete(API_PATH)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Result
    const result = await db.ref(TRELLO_CREDENTIAL_DB_PATH).once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it('should allow any admin to remove the trello credentials of an organization', async () => {
    const altAdminUserId = uuid();

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_CREDENTIALS_DATA);
    await db
      .ref(`/users/${altAdminUserId}`)
      .set({ admin: true, corporate: false }); // add another admin user

    // Execute
    const app = deleteTrelloAuthApp(db, stubFirbaseAuth(altAdminUserId));
    await request(app)
      .delete(API_PATH)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Result
    const result = await db.ref(TRELLO_CREDENTIAL_DB_PATH).once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it('should cleanup the public facing trello integration details for the organization', async () => {
    const altAdminUserId = uuid();

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_CREDENTIALS_DATA);
    await db
      .ref(TRELLO_INTEGRATIONS_ORG_DB_PATH)
      .set(TRELLO_INTEGRATION_ORG_DATA);
    await db
      .ref(`/users/${altAdminUserId}`)
      .set({ admin: true, corporate: false }); // add another admin user

    // Execute
    const app = deleteTrelloAuthApp(db, stubFirbaseAuth(altAdminUserId));
    await request(app)
      .delete(API_PATH)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Result
    const result = await db.ref(TRELLO_INTEGRATIONS_ORG_DB_PATH).once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it('should archive the trello integration configurations for all properties', async () => {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER_DATA);
    await db
      .ref(TRELLO_INTEGRATIONS_DB_PATH_ONE)
      .set(PROPERTY_INTEGRATIONS_DATA);
    await db
      .ref(TRELLO_INTEGRATIONS_DB_PATH_TWO)
      .set(PROPERTY_INTEGRATIONS_DATA);
    const expectedSnap = await db
      .ref('/integrations/trello/properties')
      .once('value');
    const expected = expectedSnap.val();

    // Execute
    const app = deleteTrelloAuthApp(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .delete(API_PATH)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Results
    const resultConfigs = await Promise.all([
      db.ref(TRELLO_INTEGRATIONS_DB_PATH_ONE).once('value'),
      db.ref(TRELLO_INTEGRATIONS_DB_PATH_TWO).once('value'),
    ]);
    const resultArchive = await db
      .ref('/archive/integrations/trello/properties')
      .once('value');
    const actualConfigs = resultConfigs.map(r => r.exists());
    const actual = resultArchive.val();

    // Assertions
    expect(actualConfigs).to.deep.equal(
      [false, false],
      'removed active configs'
    );
    expect(actual).to.deep.equal(expected, 'moved all configs to archive');
  });
});
