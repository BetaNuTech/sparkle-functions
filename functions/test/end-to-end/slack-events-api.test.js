const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');

const slackEventsApiHandler = require('../../slack/create-slack-events-api-handler');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('../setup');

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
const APP_UNINSTALL_EVENT_DATA = {
  token: 'XXYYZZ',
  team_id: ORGANIZATION_DATA.team,
  api_app_id: 'AXXXXXXXXX',
  event: {
    type: 'app_uninstalled',
  },
  type: 'app_uninstalled',
  event_id: 'EvXXXXXXXX',
  event_time: 1234567890,
};

describe('Slack App Delete', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should send a challenge token as a response to a url validation request', async function() {
    const expected = '3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P';
    const urlVerificationBody = {
      token: 'Jhj5dZrVaK7ZwHHjRyZWjbDl',
      challenge: expected,
      type: 'url_verification',
    };
    // Execute & Get Result
    const app = slackEventsApiHandler(db);
    const result = await request(app)
      .post('/')
      .send(urlVerificationBody)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    const actual = result.body.challenge;
    expect(actual).to.equal(expected);
  });

  it('should reject request when uninstalled Slack team does not match organization', async function() {
    const expected = 'error';
    await db.ref(`${SLACK_INTEGRATION_DB_PATH}`).set(ORGANIZATION_DATA);

    const body = {
      ...APP_UNINSTALL_EVENT_DATA,
      team_id: 'wrong_id',
    };

    // Execute & Get Result
    const app = slackEventsApiHandler(db);
    const result = await request(app)
      .post('/')
      .send(body)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal(expected);
  });

  it('should cleanup slack data for organization', async function() {
    await db.ref(`${SLACK_INTEGRATION_DB_PATH}`).set(ORGANIZATION_DATA);
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration
    await db.ref(`${SLACK_NOTIFICATIONS_DB_PATH}/channel/one`).set({
      message: 'Test message',
      title: 'Test title',
    });

    // Execute & Get Result
    const app = slackEventsApiHandler(db);
    const result = await request(app)
      .post('/')
      .send(APP_UNINSTALL_EVENT_DATA)
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
        actual: result.body.message,
        expected: 'successful',
        msg: 'sent successful response message',
      },
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
