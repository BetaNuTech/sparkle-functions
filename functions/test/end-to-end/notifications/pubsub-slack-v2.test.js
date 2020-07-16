const { expect } = require('chai');
const nock = require('nock');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const systemModel = require('../../../models/system');
const notificationsModel = require('../../../models/notifications');
const integrationsModel = require('../../../models/integrations');
const SLACK_API_JOIN_CHAN_RESPONSE = require('../../../test-helpers/mocks/slack-joined-channel');
const SLACK_API_PUB_MSG_RESP = require('../../../test-helpers/mocks/slack-published-message');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Notifications | Pubsub | Publish Slack V2', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(null, fs);
  });

  it("should attempt to join all Slack notification's channels", async () => {
    const notification1Id = uuid();
    const notification2Id = uuid();
    const channelOne = `channel-${uuid()}`;
    const channelTwo = `channel-${uuid()}`;
    const credentials = mocking.createSlackCredentials();
    const integration = mocking.createSlackIntegration();
    const notification1 = mocking.createNotification(
      {},
      {
        title: 'title-1',
        message: 'message-1',
        channel: channelOne,
        createdAt: mocking.nowUnix(),
      }
    );
    const notification2 = mocking.createNotification(
      {},
      {
        title: 'title-2',
        message: 'message-2',
        channel: channelTwo,
        createdAt: mocking.nowUnix(),
      }
    );

    // Stub requests
    const channelOneReq = nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: credentials.accessToken,
        name: channelOne,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);
    const channelTwoReq = nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: credentials.accessToken,
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
    await systemModel.firestoreUpsertSlack(fs, credentials);
    await integrationsModel.firestoreSetSlack(fs, integration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notification1Id,
      notification1
    );
    await notificationsModel.firestoreCreateRecord(
      fs,
      notification2Id,
      notification2
    );

    // Execute
    await test.wrap(cloudFunctions.publishSlackNotificationsV2)();

    // Assertions
    [
      {
        actual: channelOneReq.isDone(),
        expected: true,
        msg: 'joined channel one',
      },
      {
        actual: channelTwoReq.isDone(),
        expected: true,
        msg: 'joined channel two',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('publish all Slack messages for a requested channel', async () => {
    const notification1Id = uuid();
    const notification2Id = uuid();
    const notification3Id = uuid();
    const channel = `channel${uuid()}`;
    const otherChannel = `channel${uuid()}`;
    const credentials = mocking.createSlackCredentials();
    const integration = mocking.createSlackIntegration();
    const notification1 = mocking.createNotification(
      {},
      {
        title: 'title-1',
        message: 'message-1',
        channel,
        createdAt: mocking.nowUnix(),
      }
    );
    const notification2 = mocking.createNotification(
      {},
      {
        title: 'title-2',
        message: 'message-2',
        channel,
        createdAt: mocking.nowUnix(),
      }
    );
    const notification3 = mocking.createNotification(
      {},
      {
        title: 'title-2',
        message: 'message-2',
        channel: otherChannel,
        createdAt: mocking.nowUnix(),
      }
    );

    // Stub request
    nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: credentials.accessToken,
        name: channel,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);

    const postedChannels = [];
    nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(({ channel: postChannel }) => {
        postedChannels.push(postChannel);
        return true;
      })
      .reply(200, SLACK_API_PUB_MSG_RESP);

    // Setup Database
    await systemModel.firestoreUpsertSlack(fs, credentials);
    await integrationsModel.firestoreSetSlack(fs, integration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notification1Id,
      notification1
    );
    await notificationsModel.firestoreCreateRecord(
      fs,
      notification2Id,
      notification2
    );
    await notificationsModel.firestoreCreateRecord(
      fs,
      notification3Id,
      notification3
    );

    // Execute
    const message = { data: Buffer.from(channel).toString('base64') };
    await test.wrap(cloudFunctions.publishSlackNotificationsV2)(message);

    // Test result
    const notification1Snap = await notificationsModel.firestoreFindRecord(
      fs,
      notification1Id
    );
    const notification1PubMediums =
      (notification1Snap.data() || {}).publishedMediums || {};
    const notification2Snap = await notificationsModel.firestoreFindRecord(
      fs,
      notification2Id
    );
    const notification2PubMediums =
      (notification2Snap.data() || {}).publishedMediums || {};
    const notification3Snap = await notificationsModel.firestoreFindRecord(
      fs,
      notification3Id
    );
    const notification3PubMediums =
      (notification3Snap.data() || {}).publishedMediums || {};

    // Assertions
    [
      {
        actual: postedChannels.includes(otherChannel),
        expected: false,
        msg: 'did not post message to unrequested channel',
      },
      {
        actual: Boolean(notification1PubMediums.slack),
        expected: true,
        msg: 'updated notification 1 as published to Slack',
      },
      {
        actual: Boolean(notification2PubMediums.slack),
        expected: true,
        msg: 'updated notification 2 as published to Slack',
      },
      {
        actual: notification3PubMediums.slack === false,
        expected: true,
        msg: 'did not update notification 3 as published to Slack',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('records a successfully joined channel in Slack integration', async () => {
    const notificationId = uuid();
    const credentials = mocking.createSlackCredentials();
    const channel = 'test-channel';
    const integration = mocking.createSlackIntegration();
    const notification = mocking.createNotification(
      {},
      {
        channel,
        title: 'title',
        message: 'message',
        createdAt: mocking.nowUnix(),
      }
    );

    // Stub request
    nock('https://slack.com')
      .persist()
      .post('/api/channels.join')
      .query({
        token: credentials.accessToken,
        name: channel,
        validate: true,
      })
      .reply(200, SLACK_API_JOIN_CHAN_RESPONSE);
    nock('https://slack.com')
      .persist()
      .post('/api/chat.postMessage')
      .query(true)
      .reply(200, SLACK_API_PUB_MSG_RESP);

    // Setup Database
    await systemModel.firestoreUpsertSlack(fs, credentials);
    await integrationsModel.firestoreSetSlack(fs, integration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notificationId,
      notification
    );
    // Execute
    const message = { data: Buffer.from(channel).toString('base64') };
    await test.wrap(cloudFunctions.publishSlackNotificationsV2)(message);

    // Test result
    const integrationSnap = await integrationsModel.firestoreFindSlack(fs);
    const actual =
      ((integrationSnap.data() || {}).joinedChannelNames || {})[channel] || 0;

    // Assertions
    expect(actual).to.be.above(0);
  });
});
