const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const trelloTokenAppEndpoint = require('../../../trello/on-create-request-handler');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('../../setup');
const GET_TRELLO_TOKEN_PAYLOAD = require('../../../test-helpers/mocks/get-trello-token.json');
const GET_TRELLO_MEMBER_PAYLOAD = require('../../../test-helpers/mocks/get-trello-member.json');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = '42717812300353f59dea0f62446ab1e5';
const TRELLO_AUTH_TOKEN =
  '65a38f006f3e81cdab47ec3044cf83364aa66d3469c3923e8190c2a8e60325f1';
const TRELLO_MEMBER_ID = GET_TRELLO_TOKEN_PAYLOAD.idMember;
const TRELLO_USERNAME = GET_TRELLO_MEMBER_PAYLOAD.username;

describe('Trello Upsert Token', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject requests missing required trello credentials', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post('/integrations/trello/authorization')
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

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(user2Id));
    const result = await request(app)
      .post('/integrations/trello/authorization')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return an authorization error when invalid trello credentials are provided', async function() {
    // Stub Request
    nock('https://api.trello.com')
      .get(`/1/tokens/1234?key=1234`)
      .reply(400, {});

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post('/integrations/trello/authorization')
      .send({
        apikey: '1234',
        authToken: '1234',
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('trello token request not authorized');
  });

  it('should save trello credentials in the private database path', async function() {
    const expectedEmail = 'test@gmail.com';
    const expectedFullName = 'Test User';

    // Stub Requests
    nock('https://api.trello.com')
      .get(`/1/tokens/${TRELLO_AUTH_TOKEN}?key=${TRELLO_API_KEY}`)
      .reply(200, Object.assign({}, GET_TRELLO_TOKEN_PAYLOAD));

    nock('https://api.trello.com')
      .get(
        `/1/members/${TRELLO_MEMBER_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(
        200,
        Object.assign({}, GET_TRELLO_MEMBER_PAYLOAD, {
          id: TRELLO_MEMBER_ID,
          email: expectedEmail,
          fullName: expectedFullName,
        })
      );

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post('/integrations/trello/authorization')
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
      .ref(`/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`)
      .once('value');
    const credentials = credentialsSnap.val();

    // Assertions
    [
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

  it('should save trello user details to the trello integration organization', async function() {
    const expectedEmail = 'test@gmail.com';
    const expectedFullName = 'Test User';

    // Stub Requests
    nock('https://api.trello.com')
      .get(`/1/tokens/${TRELLO_AUTH_TOKEN}?key=${TRELLO_API_KEY}`)
      .reply(200, Object.assign({}, GET_TRELLO_TOKEN_PAYLOAD));

    nock('https://api.trello.com')
      .get(
        `/1/members/${TRELLO_MEMBER_ID}?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(
        200,
        Object.assign({}, GET_TRELLO_MEMBER_PAYLOAD, {
          id: TRELLO_MEMBER_ID,
          email: expectedEmail,
          fullName: expectedFullName,
        })
      );

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = trelloTokenAppEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post('/integrations/trello/authorization')
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
      .ref(`/integrations/trello/organization`)
      .once('value');
    const credentials = credentialsSnap.val();

    // Assertions
    [
      {
        name: 'member',
        expected: TRELLO_MEMBER_ID,
        actual: credentials.member,
      },
      {
        name: 'trelloUsername',
        expected: TRELLO_USERNAME,
        actual: credentials.trelloUsername,
      },
      {
        name: 'trelloFullName',
        expected: expectedFullName,
        actual: credentials.trelloFullName,
      },
      {
        name: 'trelloEmail',
        expected: expectedEmail,
        actual: credentials.trelloEmail,
      },
    ].forEach(({ name, expected, actual }) => {
      expect(actual).to.equal(
        expected,
        `integration detail "${name}" persisted correctly`
      );
    });

    expect(credentials.createdAt).to.be.a('number', 'has createdAt timestamp');
    expect(credentials.updatedAt).to.be.a('number', 'has updatedAt timestamp');
    expect(credentials.updatedAt).to.equal(
      credentials.createdAt,
      'updatedAt equal createdAt'
    );
  });

  it('rejects reading and writing to unauthorized private system database', async () => {
    const dbErrs = [];

    try {
      await db
        .ref('/system/integrations/unauth-id/trello/organization')
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
        .ref('/system/integrations/unauth-id/trello/organization')
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
