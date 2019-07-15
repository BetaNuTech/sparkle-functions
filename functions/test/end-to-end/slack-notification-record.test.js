const { expect } = require('chai');
const request = require('supertest');

const slackNotificationEndpoint = require('../../slack/create-notification-record-handler');
const uuid = require('../../test-helpers/uuid');
const {
  cleanDb,
  stubFirbaseAuth,
  createPubSubStub,
} = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };

const PROPERTY_ID = uuid();
const PROPERTY_DATA = {
  name: `name${PROPERTY_ID}`,
};

const SLACK_CREDENTIAL_DB_PATH = `/system/integrations/slack/organization/${SERVICE_ACCOUNT_ID}`;

describe('Slack Notification Records', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(SLACK_CREDENTIAL_DB_PATH).remove();
  });

  it('should reject requests missing required payload', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send({})
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    expect(result.body.message).to.equal(
      'Slack Notification Records requires: title message'
    );
  });

  it('should reject request from non-admin user with an unauthorized status', async function() {
    const userId2 = uuid();
    const user2 = { admin: false, corporate: true };

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set(user2); // add non-admin user

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(userId2),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return error if property cannot be found', async function() {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send({
        title: 'Redecorate',
        message: 'Front room needs new paint',
        property: '1234',
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal('property cannot be found');
  });

  it('should abandon request if no slack channel associated to requested property', async function() {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send({
        title: 'Redecorate',
        message: 'Front room needs new paint',
        property: PROPERTY_ID,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'no Slack channel associated with this property'
    );
  });

  it('should abandon request for an admin notification when there is no admin channel configured', async function() {
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA); // Add property

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send({
        title: 'Redecorate',
        message: 'Front room needs new paint',
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal('Admin channel has not been setup');
  });

  it('should successfully save property notifications under their configured channel name', async function() {
    const propertyData = {
      name: 'Mt. Bedrock',
      slackChannel: '#bedrock',
    };
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(propertyData); // Add property

    const requestPayload = {
      title: 'Redecorate',
      message: 'Front room needs new paint',
      property: PROPERTY_ID,
    };

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send(requestPayload)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // Actuals
    const slackNotificationsSnap = await db
      .ref(`/notifications/slack`)
      .once('value');
    const slackNotifications = slackNotificationsSnap.val();
    const [slackChannel] = Object.keys(slackNotifications);
    const [actual] = Object.values(slackNotifications[slackChannel]);

    // Assertions
    expect(result.body.message).to.equal(
      'successfully saved slack app authorization'
    );
    expect(actual).to.deep.equal(
      { title: requestPayload.title, message: requestPayload.message },
      'Request payload for property notification is correct'
    );
  });

  it('should successfully save admin notifications under their configured channel name', async function() {
    const slackChannel = 'AdminArea';
    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db
      .ref('/integrations/slack/organization/channelName')
      .set(slackChannel); // Add admin channel name

    const requestPayload = {
      title: 'Redecorate',
      message: 'Front room needs new paint',
    };

    // Execute & Get Result
    const app = slackNotificationEndpoint(
      db,
      stubFirbaseAuth(USER_ID),
      createPubSubStub(),
      'notifications-sync'
    );
    const result = await request(app)
      .post(`/notifications`)
      .send(requestPayload)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // Actuals
    const slackNotificationsSnap = await db
      .ref(`/notifications/slack/${slackChannel}`)
      .once('value');
    const [actual] = Object.values(slackNotificationsSnap.val());

    // Assertions
    expect(result.body.message).to.equal(
      'successfully saved slack app authorization'
    );
    expect(actual).to.deep.equal(
      { title: requestPayload.title, message: requestPayload.message },
      'Request payload for property notification is correct'
    );
  });
});
