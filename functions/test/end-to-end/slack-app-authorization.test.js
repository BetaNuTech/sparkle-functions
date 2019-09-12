const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');

const slackAppAuthEndpoint = require('../../slack/on-create-request-handler');
const uuid = require('../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('./setup');
const { slackApp } = require('../../config');

const USER_ID = uuid();
const USER = { admin: true, corporate: true };
const SLACK_CODE = '1234';
const SLACK_REDIRECT_URI = 'http://sleepy-cliffs-61733.herokuapp.com';
const SLACK_APP_CLIENT_ID = slackApp.clientId;
const SLACK_APP_CLIENT_SECRET = slackApp.clientSecret;
const SLACK_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/slack/organization`;
const SLACK_INTEGRATION_DB_PATH = '/integrations/slack/organization';

describe('Slack App Authorization', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    await db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should reject requests missing required payload', async function() {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackAppAuthEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post(`/integrations/slack/authorization`)
      .send({})
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    expect(result.body.message).to.equal(
      'Slack Auth Handler requires: slackCode redirectUri'
    );
  });

  it('should reject request from non-admin user with an unauthorized status', async function() {
    const userId2 = uuid();
    const user2 = { admin: false, corporate: true };

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/users/${userId2}`).set(user2); // add non-admin user

    // Execute & Get Result
    const app = slackAppAuthEndpoint(db, stubFirbaseAuth(userId2));
    const result = await request(app)
      .post(`/integrations/slack/authorization`)
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(401);

    // Assertions
    expect(result.body.message).to.equal('invalid credentials');
  });

  it('should return message from any Slack API error responses', async function() {
    const fakeSlackCode = '1234';
    const fakeRedirectUri = 'www.google.com';

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Stub request
    nock('https://slack.com')
      .persist()
      .post(
        `/api/oauth.access?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${fakeSlackCode}&redirect_uri=${fakeRedirectUri}`
      )
      .reply(200, {
        ok: false,
        error: 'invalid_code',
      });

    // Execute & Get Result
    const app = slackAppAuthEndpoint(db, stubFirbaseAuth(USER_ID));
    const result = await request(app)
      .post(`/integrations/slack/authorization`)
      .send({
        slackCode: fakeSlackCode,
        redirectUri: fakeRedirectUri,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(500);

    // Assertions
    expect(result.body.message).to.equal(
      'Error from slack API: Error: invalid_code'
    );
  });

  it('should store slack apps credentials inside system integrations path', async function() {
    const expected = {
      accessToken: 'xoxp-access-token',
      scope: 'identify,incoming-webhook',
    };

    // Stub Slack OAuth
    nock('https://slack.com')
      .persist()
      .post(
        `/api/oauth.access?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${SLACK_CODE}&redirect_uri=${SLACK_REDIRECT_URI}`
      )
      .reply(200, {
        ok: true,
        access_token: expected.accessToken,
        scope: expected.scope,
        user_id: 'U0FAKEID',
        team_name: 'Slack Team Name',
        team_id: 'T0FAKEID',
        incoming_webhook: {
          channel: '#channel_name',
          channel_id: 'C0HANNELID',
          configuration_url: 'https://orgname.slack.com/services/SERVICEID',
          url: 'https://hooks.slack.com/services/SERVICEID/FAKEID123/NOTHING',
        },
      });

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackAppAuthEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post(`/integrations/slack/authorization`)
      .send({
        slackCode: SLACK_CODE,
        redirectUri: SLACK_REDIRECT_URI,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // actuals
    const actualSnap = await db.ref(SLACK_CREDENTIAL_DB_PATH).once('value');

    // Assertions
    const actual = actualSnap.val();
    expect(actual.scope).to.equal(
      expected.scope,
      'persisted requested scope level'
    );
    expect(actual.accessToken).to.equal(
      expected.accessToken,
      'persisted access token'
    );
  });

  it("should store slack apps public details in the organization's integrations path", async () => {
    const expected = {
      grantedBy: USER_ID,
      team: uuid(),
      teamName: 'test-team-name',
    };

    // Stub Slack OAuth
    nock('https://slack.com')
      .persist()
      .post(
        `/api/oauth.access?client_id=${SLACK_APP_CLIENT_ID}&client_secret=${SLACK_APP_CLIENT_SECRET}&code=${SLACK_CODE}&redirect_uri=${SLACK_REDIRECT_URI}`
      )
      .reply(200, {
        ok: true,
        access_token: 'aldkldajf',
        scope: 'identify,incoming-webhook',
        user_id: 'U0FAKEID',
        team_name: expected.teamName,
        team_id: expected.team,
        incoming_webhook: {
          channel: '#channel_name',
          channel_id: 'C0HANNELID',
          configuration_url: 'https://orgname.slack.com/services/SERVICEID',
          url: 'https://hooks.slack.com/services/SERVICEID/FAKEID123/NOTHING',
        },
      });

    // Setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user

    // Execute & Get Result
    const app = slackAppAuthEndpoint(db, stubFirbaseAuth(USER_ID));
    await request(app)
      .post(`/integrations/slack/authorization`)
      .send({
        slackCode: SLACK_CODE,
        redirectUri: SLACK_REDIRECT_URI,
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // actuals
    const snap = await db.ref(SLACK_INTEGRATION_DB_PATH).once('value');
    const actual = snap.val() || {};

    // Assertions
    Object.keys(expected).forEach(name => {
      expect(actual[name]).to.equal(
        expected[name],
        `Found "${name}" in Slack Integration details`
      );
    });

    expect(actual.createdAt).to.be.a('number', 'set "createdAt" timestamp');
  });
});
