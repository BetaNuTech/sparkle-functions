const sinon = require('sinon');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const regTokenModel = require('../../../models/registration-tokens');
const notificationsModel = require('../../../models/notifications');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, test, cloudFunctions, messaging } = require('../../setup');

describe('Notifications | Pubsub | Publish Push V2', () => {
  afterEach(async () => {
    sinon.restore();
    await cleanDb(null, fs);
  });

  it("marks a notification's push messages as completely published", async () => {
    const user1Id = uuid();
    const user2Id = uuid();
    const notificationId = uuid();
    const pushConfig = {
      [user1Id]: {
        title: 'title',
        message: 'message',
        createdAt: mocking.nowUnix(),
      },
      [user2Id]: {
        title: 'title',
        message: 'message',
        createdAt: mocking.nowUnix(),
      },
    };
    const notification = mocking.createNotification(null, null, pushConfig); // has 1 push target
    const regTokens = { [uuid()]: mocking.nowUnix() };
    const sendtoDevicePayload = { multicastId: uuid() };

    // Stup Requests
    sinon.stub(messaging, 'sendToDevice').resolves(sendtoDevicePayload);

    // Setup Database
    await regTokenModel.createRecord(fs, user1Id, regTokens);
    await regTokenModel.createRecord(fs, user2Id, regTokens);
    await notificationsModel.createRecord(fs, notificationId, notification);

    // Execute
    const message = { data: Buffer.from(notificationId) };
    await test.wrap(cloudFunctions.publishPushNotificationsV2)(message);

    // Test Results
    const resultSnap = await notificationsModel.findRecord(fs, notificationId);
    const result = resultSnap.data() || {};

    // Assertions
    [
      {
        actual: (result.publishedMediums || {}).push || false,
        expected: true,
        msg: 'marked push medium as completely published',
      },
      {
        actual: (result.push || {})[user1Id] || null,
        expected: null,
        msg: 'removed user one push message record',
      },
      {
        actual: (result.push || {})[user2Id] || null,
        expected: null,
        msg: 'removed user one push message record',
      },
      {
        actual: result.unpublishedPush,
        expected: 0,
        msg: 'set unpublished push messages to zero',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('removes a push message for a user without registration tokens', async () => {
    const expected = undefined;
    const userId = uuid();
    const notificationId = uuid();
    const pushConfig = {
      [userId]: {
        title: 'title',
        message: 'message',
        createdAt: mocking.nowUnix(),
      },
    };
    const notification = mocking.createNotification(null, null, pushConfig); // has 1 push target
    const sendtoDevicePayload = { multicastId: uuid() };

    // Stup Requests
    sinon.stub(messaging, 'sendToDevice').resolves(sendtoDevicePayload);

    // Setup Database
    await notificationsModel.createRecord(fs, notificationId, notification);

    // Execute
    const message = { data: Buffer.from(notificationId) };
    await test.wrap(cloudFunctions.publishPushNotificationsV2)(message);

    // Test Results
    const resultSnap = await notificationsModel.findRecord(fs, notificationId);
    const result = resultSnap.data() || {};
    const actual = (result.push || {})[userId];

    // Assertions
    expect(actual).to.equal(expected);
  });
});
