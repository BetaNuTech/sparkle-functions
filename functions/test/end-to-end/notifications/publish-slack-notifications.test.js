const { expect } = require('chai');
const nock = require('nock');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../setup');

const SLACK_CHANNEL = 'development';
const SLACK_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/slack/organization`;
const INTEGRATION_PAYLOAD = {
  accessToken: 'xoxp-3817900792-3817900802',
  scope: 'identify,incoming-webhook,chat:write,chat:write:bot',
};
const SLACK_API_JOIN_CHAN_RESPONSE = {
  ok: true,
  channel: {
    id: 'CG9A762TT',
    name: 'development',
    is_channel: true,
    created: 1550501929,
    is_archived: false,
    is_general: false,
    unlinked: 0,
    creator: 'U03Q1SGPL',
    name_normalized: 'development',
    is_shared: false,
    is_org_shared: false,
    is_member: true,
    is_private: false,
    is_mpim: false,
    members: ['U03Q1SGPL', 'UJYB0DZK8'],
    topic: {
      value: '',
      creator: '',
      last_set: 0,
    },
    purpose: {
      value: 'Talk about development',
      creator: 'U03Q1SGPL',
      last_set: 1550501929,
    },
    previous_names: [],
  },
  already_in_channel: false,
};
const SLACK_API_PUB_MSG_RESP = {
  ok: true,
  channel: 'CG9A762TT',
  ts: '1562925218.001200',
  message: {
    type: 'message',
    subtype: 'bot_message',
    text: '    *THIS IS TITLE*\n\n   this is body',
    ts: '1562925218.001200',
    username: 'JWC Sparkle Inspections',
    bot_id: 'BLC0KDFLG',
  },
};
const SLACK_NOTIFICATION_DATA = { title: 'title', message: 'message' };

describe('Publish Slack notification', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it("should attempt to join all Slack notification's channels", async () => {
    const notificationId = uuid();
    const notificationId2 = uuid();
    const channelOne = `channel-${uuid()}`;
    const channelTwo = `channel-${uuid()}`;

    // Stub requests
    const channelOneReq = nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: INTEGRATION_PAYLOAD.accessToken,
        name: channelOne,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);
    const channelTwoReq = nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: INTEGRATION_PAYLOAD.accessToken,
        name: channelTwo,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);
    nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(true)
      .reply(200, SLACK_API_PUB_MSG_RESP);

    // Setup Database
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration
    await db
      .ref(`/notifications/slack/${channelOne}/${notificationId}`)
      .set(SLACK_NOTIFICATION_DATA);

    await db
      .ref(`/notifications/slack/${channelTwo}/${notificationId2}`)
      .set(SLACK_NOTIFICATION_DATA);

    // Execute
    await test.wrap(cloudFunctions.publishSlackNotifications)();

    // Assertions
    expect(channelOneReq.isDone()).to.equal(true, 'joined channel one');
    expect(channelTwoReq.isDone()).to.equal(true, 'joined channel two');
  });

  it('should successfully publish and cleanup all Slack notifications', async () => {
    const expected = `*test*

msg`;

    // Stub request
    nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: INTEGRATION_PAYLOAD.accessToken,
        name: SLACK_CHANNEL,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);

    nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(({ text: actual }) => {
        expect(actual).to.equal(expected, 'published expected message');
        return true;
      })
      .reply(200, SLACK_API_PUB_MSG_RESP);

    const notificationId = uuid();
    const notificationId2 = uuid();

    // Setup database
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration
    await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId}`)
      .set({ title: 'test', message: 'msg' }); // adding one notification that can be processed

    await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId2}`)
      .set({ title: 'test', message: 'msg' }); // adding one notification that can be processed

    // Execute
    await test.wrap(cloudFunctions.publishSlackNotifications)();

    // Test result
    const actual = await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId}`)
      .once('value');

    const actual2 = await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId2}`)
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(
      false,
      `synced /notifications/slack/${SLACK_CHANNEL}/${notificationId} by removing once message has sent`
    );
    expect(actual2.exists()).to.equal(
      false,
      `synced /notifications/slack/${SLACK_CHANNEL}/${notificationId2} by removing once message has sent`
    );
  });

  it("should successfully publish a property's (untitled) Slack notifications", async () => {
    const expected = 'untitled-msg';

    // Stub request
    nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: INTEGRATION_PAYLOAD.accessToken,
        name: SLACK_CHANNEL,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);

    const messagePOST = nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(({ text: actual }) => {
        expect(actual).to.equal(expected);
        return true;
      })
      .reply(200, SLACK_API_PUB_MSG_RESP);

    const notificationId = uuid();

    // Setup database
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration
    await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId}`)
      .set({ title: '', message: expected }); // Empty title property notification

    // Execute
    await test.wrap(cloudFunctions.publishSlackNotifications)();

    // Assertions
    expect(messagePOST.isDone()).to.equal(true);
  });

  it('should record a successfully joined channel in integrations', async () => {
    // Stub request
    nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: INTEGRATION_PAYLOAD.accessToken,
        name: SLACK_CHANNEL,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);

    nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(true)
      .reply(200, SLACK_API_PUB_MSG_RESP);

    const notificationId = uuid();

    // Setup database
    await db.ref(SLACK_CREDENTIAL_DB_PATH).set(INTEGRATION_PAYLOAD); // adding slack integration configuration

    await db
      .ref(`/notifications/slack/${SLACK_CHANNEL}/${notificationId}`)
      .set({
        title: 'testing notification',
        message: 'we need to resolve this issue.',
      }); // adding one notification that can be processed

    // Execute
    await test.wrap(cloudFunctions.publishSlackNotifications)();

    // Test result
    const snap = await db
      .ref(
        `/integrations/slack/organization/joinedChannelNames/${SLACK_CHANNEL}`
      )
      .once('value');
    const actual = snap.val();

    // Assertions
    expect(actual).to.be.a('number');
  });
});
