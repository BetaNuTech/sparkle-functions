// const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const authUser = require('./auth-firebase-user');
const uuid = require('../test-helpers/uuid');

const PROPERTY_ID = uuid();
const successHandler = (req, res) => res.status(200).send();

describe('Utils | Auth Firebase User', () => {
  it('should require an authorization header', () => {
    const db = createDbStub();
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .expect(401);
  });

  it('should require a firebase JSON web token authorization header', () => {
    const db = createDbStub();
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'non-fb-jwt 123')
      .expect(401);
  });

  it('should reject an unverifiable token', () => {
    const db = createDbStub();
    const auth = createAuthStub({
      verifyIdToken: () => Promise.reject(),
    });

    // Execute & Get Result
    const app = createApp(authUser(db, auth), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should reject a non-admin user when requested', () => {
    const db = createDbStub({}, { properties: { [uuid()]: true } }); // property level user
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, true), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should authorize an admin user', () => {
    const db = createDbStub({}, { admin: true });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, true), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should authorize an admin user from Firestore', () => {
    const db = createFsStub({}, { admin: true });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, true), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should reject a non-admin user when requested via permissions hash', () => {
    const db = createDbStub({}, { properties: { [PROPERTY_ID]: true } }); // property level user
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, { admin: true }), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should authorize an admin user via permissions hash', () => {
    const db = createDbStub({}, { admin: true });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, { admin: true }), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should reject a non-corporate user when requested via permissions hash', () => {
    const db = createDbStub({}, { properties: { [PROPERTY_ID]: true } }); // property level user
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(
      authUser(db, auth, { corporate: true }),
      successHandler
    );

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should authorize a corporate user via permissions hash', () => {
    const db = createDbStub({}, { corporate: true });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(
      authUser(db, auth, { corporate: true }),
      successHandler
    );

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should reject a non-property user when requested via permissions hash', () => {
    const db = createDbStub({}, { corporate: true });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(
      authUser(db, auth, { property: true }),
      successHandler
    );

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should authorize a property level user via permissions hash', () => {
    const db = createDbStub({}, { properties: { [PROPERTY_ID]: true } });
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(
      authUser(db, auth, { property: true }),
      successHandler
    );

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should reject a non-team user when requested via permissions hash', () => {
    const db = createDbStub({}, { teams: { [uuid()]: { [uuid()]: true } } }); // has team access to different property
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, { team: true }), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(401);
  });

  it('should authorize a team level user via permissions hash', () => {
    const db = createDbStub(
      {},
      { teams: { [uuid()]: { [PROPERTY_ID]: true } } }
    );
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, { team: true }), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should authorize a team level user via permissions hash', () => {
    const db = createDbStub(
      {},
      { teams: { [uuid()]: { [PROPERTY_ID]: true } } }
    );
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(authUser(db, auth, { team: true }), successHandler);

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });

  it('should authorize the lowest level when many levels permitted', () => {
    const db = createDbStub({}, { properties: { [PROPERTY_ID]: true } }); // property access only
    const auth = createAuthStub();

    // Execute & Get Result
    const app = createApp(
      authUser(db, auth, { admin: true, property: true }), // admin and property
      successHandler
    );

    return request(app)
      .get(`/${PROPERTY_ID}`)
      .set('Authorization', 'fb-jwt 123')
      .expect(200);
  });
});

function createApp(...middleware) {
  const app = express();
  app.get('/:propertyId', ...middleware);
  return app;
}

function createDbStub(config = {}, userConfig = {}) {
  return Object.assign(
    {
      ref: () => ({
        once: () =>
          Promise.resolve({
            val: () => Object.assign({ id: uuid() }, userConfig),
          }),
      }),
    },
    config
  );
}

function createFsStub(config = {}, userConfig = {}) {
  return {
    collection: () => ({
      doc: () => ({
        get: () =>
          Promise.resolve({
            id: uuid(),
            data: () => ({ ...userConfig }),
          }),
      }),
    }),
    ...config,
  };
}

function createAuthStub(config = {}, tokenConfig = {}) {
  return Object.assign(
    {
      verifyIdToken: () =>
        Promise.resolve(
          Object.assign({ uid: `user-id-${uuid()}` }, tokenConfig)
        ),
    },
    config
  );
}
