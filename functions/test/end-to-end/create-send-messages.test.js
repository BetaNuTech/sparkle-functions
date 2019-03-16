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

  it('should reject with "403" status when a user\'s not an admin', async function() {
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
