const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const trelloTokenAppEndpoint = require('../../trello/on-create-request-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

const PROPERTY_ID = uuid();
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
};

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = '42717812300353f59dea0f62446ab1e5';
const TRELLO_AUTH_TOKEN =
  '65a38f006f3e81cdab47ec3044cf83364aa66d3469c3923e8190c2a8e60325f1';
const GET_TRELLO_TOKEN_PAYLOAD = {
  id: '5d1254d6579aa969efb86d2d',
  identifier: 'Server Token',
  idMember: '57c864cb46ef602b2be03a80',
  dateCreated: '2019-06-25T17:07:34.268Z',
  dateExpires: null,
  permissions: [
    {
      idModel: '57c864cb46ef602b2be03a80',
      modelType: 'Member',
      read: true,
      write: true,
    },
    { idModel: '*', modelType: 'Board', read: true, write: true },
    { idModel: '*', modelType: 'Organization', read: true, write: true },
  ],
};

describe('Trello Upsert Token', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db
      .ref(
        `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}`
      )
      .remove();
  });

  it('should reject request with invalid property IDs', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(404);

    // Assertions
    expect(result.body.message).to.equal('invalid propertyId');
  });

  it('should reject requests missing required trello credentials', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .send({})
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    expect(result.body.message).to.equal(
      'Trello Token Handler requires: apikey authToken'
    );
  });

  it('should reject request from non-admin user with an unauthorized status', async function() {
    const user2Id = uuid();
    const user2 = { admin: false, corporate: true };

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${user2Id}`).set(user2); // add non-admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(user2Id));
    const result = await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return an authorization error when invalid trello credentials are provided', async function() {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .send({
        apikey: '1234',
        authToken: '1234',
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('trello request not authorized');
  });

  it('should lookup Trello member identifier and save it to private system database', async function() {
    const expected = 'test-trello-member-id';

    // Stub Requests
    nock('https://api.trello.com')
      .get(`/1/tokens/${TRELLO_AUTH_TOKEN}?key=${TRELLO_API_KEY}`)
      .reply(
        200,
        Object.assign({}, GET_TRELLO_TOKEN_PAYLOAD, { idMember: expected })
      );

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .send({
        apikey: TRELLO_API_KEY,
        authToken: TRELLO_AUTH_TOKEN,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // actuals
    const result = await db
      .ref(
        `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}/member`
      )
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should save users Trello credentials to private system database', async function() {
    // Stub Requests
    nock('https://api.trello.com')
      .get(`/1/tokens/${TRELLO_AUTH_TOKEN}?key=${TRELLO_API_KEY}`)
      .reply(200, Object.assign({}, GET_TRELLO_TOKEN_PAYLOAD));

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post(`/integrations/trello/${PROPERTY_ID}/authorization`)
      .send({
        apikey: TRELLO_API_KEY,
        authToken: TRELLO_AUTH_TOKEN,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // actuals
    const credentialsSnap = await db
      .ref(
        `/system/integrations/trello/properties/${PROPERTY_ID}/${SERVICE_ACCOUNT_ID}`
      )
      .once('value');
    const credentials = credentialsSnap.val();

    // Assertions
    [
      {
        name: 'member',
        expected: GET_TRELLO_TOKEN_PAYLOAD.idMember,
        actual: credentials.member,
      },
      {
        name: 'authToken',
        expected: TRELLO_AUTH_TOKEN,
        actual: credentials.authToken,
      },
      { name: 'apikey', expected: TRELLO_API_KEY, actual: credentials.apikey },
      { name: 'user', expected: USER_ID, actual: credentials.user },
    ].forEach(({ name, expected, actual }) => {
      expect(actual).to.equal(
        expected,
        `system credential "${name}" persisted correctly`
      );
    });
  });

  it('rejects reading and writing to unauthorized private system database', async () => {
    const dbErrs = [];

    try {
      await db
        .ref(`/system/integrations/trello/properties/${PROPERTY_ID}/unauth-id`)
        .once('value');
    } catch (err) {
      expect(err.toString().toLowerCase()).to.have.string(
        'permission_denied',
        'read access error'
      );
      dbErrs.push(err);
    }

    try {
      await db
        .ref(`/system/integrations/trello/properties/${PROPERTY_ID}/unauth-id`)
        .set({ user: '123', apikey: '123', authToken: '123' });
    } catch (err) {
      expect(err.toString().toLowerCase()).to.have.string(
        'permission_denied',
        'write access error'
      );
      dbErrs.push(err);
    }

    expect(dbErrs.length).to.equal(2, 'has read and write errors');
  });
});
