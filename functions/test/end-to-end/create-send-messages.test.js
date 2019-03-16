const assert =  require('assert');
const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../push-messages/on-create-request-handler');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, auth, deletePDFInspection } = require('./setup');

describe('Create Send Messages', () => {
  afterEach(() => cleanDb(db));

  it('should reject request without authorization', async function() {
    // Execute & Get Result
    const app = createApp(db, auth); // auth required when given
    return request(app)
      .post('/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });

  it('should reject a non-admin requester with "403" status', async function() {
    const userId = uuid();
    const user = { admin: false, corporate: true };

    // Setup database
    await db.ref(`/users/${userId}`).set(user); // add corporate-level user

    // Execute & Get Result
    const app = createApp(db, stubFirbaseAuth(userId));
    return request(app)
      .post('/')
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(403);
  });

  it('should reject a badly configured notification with a "400" status', async function() {
    const userId = uuid();
    const user = { admin: true, corporate: false };

    // Setup database
    await db.ref(`/users/${userId}`).set(user); // add admin user

    // Execute & Get Result
    const app = createApp(db, stubFirbaseAuth(userId));

    await request(app)
      .post('/')
      .send({}) // missing notification attribute
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    await request(app)
      .post('/')
      .send({ notification: { title: 'missing message' } })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    await request(app)
      .post('/')
      .send({ notification: { message: 'missing title' } })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

/**
 * Stubbed auth of methods used by
 * utils/auth-firebase-user module
 * @param  {String} userId
 * @return {Object} - stubbed firebaseAdmin.auth
 */
function stubFirbaseAuth(userId) {
  assert(userId && typeof userId === 'string', 'has user id');

  return {
    verifyIdToken: () => Promise.resolve({ uid: userId })
  };
}
