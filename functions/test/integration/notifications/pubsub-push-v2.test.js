const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const {
  createFirestore,
  createCollection,
  createSnapshot,
  createPubSubHandler,
  createMessagingStub,
} = require('../../../test-helpers/stubs');
const uuid = require('../../../test-helpers/uuid');
const regTokensModel = require('../../../models/registration-tokens');
const notificationsModel = require('../../../models/notifications');
const createHandler = require('../../../notifications/pubsub/publish-push-v2');

describe('Notifications | Pubsub | Publish Push V2', function() {
  afterEach(() => sinon.restore());

  it('looks up a single notification targeted by event message', async () => {
    const expected = uuid();
    const message = Buffer.from(expected).toString('base64');
    const notification = mocking.createNotification(); // has no push messages

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreFindRecord')
      .callsFake((_, result) => {
        actual = result;
        return Promise.resolve(createSnapshot(expected, notification));
      });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    expect(actual).to.equal(expected);
  });

  it('defaults to finding all notifications with any unpublished push messages', async () => {
    const expected = { unpublishedPush: ['>', 0] };
    const notificationId = uuid();
    const notification = mocking.createNotification(); // has no push targets

    let actual = '';
    sinon.stub(notificationsModel, 'firestoreQuery').callsFake((_, query) => {
      actual = query;
      return Promise.resolve(
        createCollection(createSnapshot(notificationId, notification))
      );
    });

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub()
    );

    expect(actual).to.deep.equal(expected);
  });

  it('publishes push messages to all a users registered tokens', async () => {
    const expected = [uuid(), uuid()];
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
    const regTokens = {
      [expected[0]]: mocking.nowUnix(),
      [expected[1]]: mocking.nowUnix(),
    };

    sinon
      .stub(notificationsModel, 'firestoreQuery')
      .resolves(createCollection(createSnapshot(notificationId, notification)));
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();
    sinon
      .stub(regTokensModel, 'firestoreFindRecord')
      .resolves(createSnapshot(userId, regTokens));

    let actual = null;
    const publisher = result => {
      actual = result;
    };

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(publisher)
    );

    expect(actual).to.deep.equal(expected);
  });

  it('publishes expected push message title and message', async () => {
    const expected = { title: 'test-title', body: 'test-message' };
    const userId = uuid();
    const notificationId = uuid();
    const pushConfig = {
      [userId]: {
        title: expected.title,
        message: expected.body,
        createdAt: mocking.nowUnix(),
      },
    };
    const notification = mocking.createNotification(null, null, pushConfig); // has 1 push target
    const regTokens = { [uuid()]: mocking.nowUnix() };

    sinon
      .stub(notificationsModel, 'firestoreQuery')
      .resolves(createCollection(createSnapshot(notificationId, notification)));
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();
    sinon
      .stub(regTokensModel, 'firestoreFindRecord')
      .resolves(createSnapshot(userId, regTokens));

    let actual = null;
    const publisher = (_, result) => {
      actual = JSON.parse(JSON.stringify(result.notification));
      delete actual.icon;
    };

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(publisher)
    );

    expect(actual).to.deep.equal(expected);
  });

  it('updates notification with state denoting all push messages published', async () => {
    const userId = uuid();
    const expected = {
      unpublishedPush: 0,
      'publishedMediums.push': true,
      [`push.${userId}`]: null, // replaces FieldValue update
    };
    const notificationId = uuid();
    const pushConfig = {
      [userId]: {
        title: 'title',
        message: 'message',
        createdAt: mocking.nowUnix(),
      },
    };
    const notification = mocking.createNotification(null, null, pushConfig); // has 1 push target
    const regTokens = { [uuid()]: mocking.nowUnix() };

    sinon
      .stub(notificationsModel, 'firestoreQuery')
      .resolves(createCollection(createSnapshot(notificationId, notification)));
    sinon
      .stub(regTokensModel, 'firestoreFindRecord')
      .resolves(createSnapshot(userId, regTokens));

    let actual = null;
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = { ...update };
        if (typeof actual[`push.${userId}`] === 'object') {
          actual[`push.${userId}`] = null;
        }
        return Promise.resolve();
      });

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub()
    );

    expect(actual).to.deep.equal(expected);
  });
});
