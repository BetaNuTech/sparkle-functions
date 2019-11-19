const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');

const slackAppDeleteEndpoint = require('../../slack/delete-slack-app');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const { slackApp } = require('../../config');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;
const SLACK_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/slack/organization`;
const SLACK_INTEGRATION_DB_PATH = '/integrations/slack/organization';
const SLACK_NOTIFICATIONS_DB_PATH = '/notifications/slack';
const INTEGRATION_PAYLOAD = {
  accessToken: 'xoxp-3817900792-3817900802',
  scope: 'identify,incoming-webhook,chat:write,chat:write:bot',
};
const ORGANIZATION_DATA = {
  createdAt: 1572567846,
  defaultChannelName: 'test-channel',
  grantedBy: 'XYZABCDEFGHIJKLM',
  joinedChannelNames: {
    'test-channel': 1572629509,
    'test-test': 1572629383,
  },
  team: 'T03Q1SGPA',
  teamName: 'Test Organization',
};

describe('Slack App Delete', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject request from non-admin user with an unauthorized status', async function() {
    const expected = 'invalid credentials';
    const userId2 = uuid();
    const user2 = { admin: false, corporate: true };

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set(user2); // add non-admin user
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration

    // Execute & Get Result
    const app = slackAppDeleteEndpoint(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .delete(`/integrations/slack/authorization`)
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('should reject bad request to uninstall non-existent Slack App', async function() {
    const expected = 'No Slack App is authorized for your organization';

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackAppDeleteEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .delete(`/integrations/slack/authorization`)
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('should return message from any Slack API error responses', async function() {
    const expected = 'Error from slack API: Error: invalid_code';

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration

    // Stub request
    nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${INTEGRATION_PAYLOAD.accessToken}`
      )
      .reply(200, {
        ok: false,
        error: 'invalid_code',
      });

    // Execute & Get Result
    const app = slackAppDeleteEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .delete(`/integrations/slack/authorization`)
      .send()
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(500);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('should cleanup database from slack app references', async function() {
    // Stub Slack app delete request
    nock('https://slack.com')
      .persist()
      .get(
        `/api/apps.uninstall?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&token=${INTEGRATION_PAYLOAD.accessToken}`
      )
      .reply(200, {
        ok: true,
      });

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration
    await db.ref(`${SLACK_NOTIFICATIONS_DB_PATH}/channel/one`).set({
      message: 'Test message',
      title: 'Test title',
    });
    await db.ref(`${SLACK_INTEGRATION_DB_PATH}`).set(ORGANIZATION_DATA);

    // Execute & Get Result
    const app = slackAppDeleteEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .delete(`/integrations/slack/authorization`)
      .send()
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(200);

    // Results
    const actualCredentialSnap = await db
      .ref(SLACK_CREDENTIAL_DB_PATH)
      .once('value');
    const actualIntegrationSnap = await db
      .ref(SLACK_INTEGRATION_DB_PATH)
      .once('value');
    const actualNotificaitionSnap = await db
      .ref(SLACK_NOTIFICATIONS_DB_PATH)
      .once('value');

    // Assertions
    [
      {
        actual: actualCredentialSnap.exists(),
        expected: false,
        msg: 'deleted slack credentials',
      },
      {
        actual: actualIntegrationSnap.exists(),
        expected: false,
        msg: 'deleted slack integration configs',
      },
      {
        actual: actualNotificaitionSnap.exists(),
        expected: false,
        msg: 'removed pending notifications',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
