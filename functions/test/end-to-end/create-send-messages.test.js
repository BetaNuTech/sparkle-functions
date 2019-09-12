const { expect } = require('chai');
const request = require('supertest');
const uuid = require('../../test-helpers/uuid');
const createApp = require('../../push-messages/on-create-request-handler');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, auth } = require('./setup');

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

  it('should write a sendMessage record for all other admins', async function() {
    const requesterId = uuid();
    const admin1Id = uuid();
    const admin2Id = uuid();
    const corporateUserId = uuid();
    const propertyUserId = uuid();
    const adminUser = { admin: true, corporate: false };
    const expected = {
      title: `title-${requesterId}`,
      message: `message-${requesterId}`,
    };

    // Setup database
    await db.ref(`/users/${requesterId}`).set(adminUser); // set requesting admin user
    await db.ref(`/users/${admin1Id}`).set(adminUser); // set other admin user
    await db.ref(`/users/${admin2Id}`).set(adminUser); // set other admin user
    await db
      .ref(`/users/${corporateUserId}`)
      .set({ admin: false, corporate: true }); // set corporate user
    await db
      .ref(`/users/${propertyUserId}`)
      .set({ admin: false, corporate: false, properties: { [uuid()]: true } }); // set property user

    // Execute
    const app = createApp(db, stubFirbaseAuth(requesterId));
    await request(app)
      .post('/')
      .send({ notification: expected })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Result
    const resultSnap = await db.ref('/sendMessages').once('value');
    const results = resultSnap.val();

    // Assertions
    const adminIds = [admin1Id, admin2Id];
    Object.keys(results).forEach(messageId => {
      const { title, message, /* recipientId, */ createdAt } = results[
        messageId
      ];
      expect(adminIds).to.include(admin1Id, 'wrote only messages to admins');
      expect(title).to.equal(expected.title, 'has expected title');
      expect(message).to.equal(expected.message, 'has expected message');
      expect(createdAt).to.be.a('number', 'has created at timestamp');
    });
  });
});
