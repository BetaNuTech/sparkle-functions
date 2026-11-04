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
const usersModel = require('../../../models/users');
const notificationsModel = require('../../../models/notifications');
const createHandler = require('../../../notifications/pubsub/publish-push-v2');

const ONE_DAY_SEC = 60 * 60 * 24;

/**
 * Create an FCM style error
 * @param  {String} code
 * @return {Error}
 */
function fcmError(code) {
  const err = Error(`fcm error: ${code}`);
  err.code = code;
  return err;
}

/**
 * Stub a single notification with
 * one push message for a user with
 * the provided registration tokens
 * @param  {Object} options
 * @return {Object}
 */
function setupSinglePush({
  regTokens = { [uuid()]: mocking.nowUnix() },
  createdAt = mocking.nowUnix(),
  noteConfig = {},
  user = {},
} = {}) {
  const userId = uuid();
  const notificationId = uuid();
  const pushConfig = {
    [userId]: { title: 'title', message: 'message', createdAt },
  };
  const notification = mocking.createNotification(noteConfig, null, pushConfig);

  sinon
    .stub(notificationsModel, 'query')
    .resolves(createCollection(createSnapshot(notificationId, notification)));
  sinon
    .stub(regTokensModel, 'findRecord')
    .resolves(createSnapshot(userId, regTokens));

  sinon
    .stub(usersModel, 'findRecord')
    .resolves(createSnapshot(userId, { pushOptOut: false, ...user }));

  const updates = [];
  sinon.stub(notificationsModel, 'updateRecord').callsFake((_, id, update) => {
    updates.push({ ...update });
    return Promise.resolve();
  });

  return { userId, notificationId, updates };
}

describe('Notifications | Pubsub | Publish Push V2', function() {
  afterEach(() => sinon.restore());

  it('looks up a single notification targeted by event message', async () => {
    const expected = uuid();
    const message = Buffer.from(expected).toString('base64');
    const notification = mocking.createNotification(); // has no push messages

    let actual = '';
    sinon.stub(notificationsModel, 'findRecord').callsFake((_, result) => {
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
    sinon.stub(notificationsModel, 'query').callsFake((_, query) => {
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

  it('sends one message to each of a users registered tokens', async () => {
    const expected = [uuid(), uuid()];
    setupSinglePush({
      regTokens: {
        [expected[0]]: mocking.nowUnix(),
        [expected[1]]: mocking.nowUnix(),
      },
    });

    const actual = [];
    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(msg => {
        actual.push(msg.token);
      })
    );

    expect(actual).to.deep.equal(expected);
  });

  it('sends an FCM v1 message with title, body, APNs alert config and data', async () => {
    const propertyId = uuid();
    const { notificationId } = setupSinglePush({
      noteConfig: { property: propertyId },
    });

    let actual = null;
    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(msg => {
        actual = msg;
      })
    );

    expect(actual.notification).to.deep.equal({
      title: 'title',
      body: 'message',
    });
    expect(actual.apns.headers['apns-push-type']).to.equal('alert');
    expect(actual.apns.headers['apns-priority']).to.equal('10');
    expect(actual.apns.payload.aps.sound).to.equal('default');
    expect(actual.data).to.deep.equal({ notificationId, propertyId });
  });

  it('omits an empty property from the message data', async () => {
    const { notificationId } = setupSinglePush();

    let actual = null;
    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(msg => {
        actual = msg.data;
      })
    );

    expect(actual).to.deep.equal({ notificationId });
  });

  it('updates notification with state denoting all push messages published', async () => {
    const { userId, updates } = setupSinglePush();
    const expected = {
      unpublishedPush: 0,
      'publishedMediums.push': true,
      [`push.${userId}`]: null, // replaces FieldValue update
    };

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub()
    );

    const actual = { ...updates[0], [`push.${userId}`]: null };
    expect(actual).to.deep.equal(expected);
  });

  it('removes tokens FCM reports as unregistered or invalid', async () => {
    const goodToken = uuid();
    const unregistered = uuid();
    const invalid = uuid();
    const { userId } = setupSinglePush({
      regTokens: {
        [goodToken]: mocking.nowUnix(),
        [unregistered]: mocking.nowUnix(),
        [invalid]: mocking.nowUnix(),
      },
    });
    const removeStub = sinon.stub(regTokensModel, 'removeTokens').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(msg => {
        if (msg.token === unregistered) {
          return Promise.reject(
            fcmError('messaging/registration-token-not-registered')
          );
        }
        if (msg.token === invalid) {
          return Promise.reject(
            fcmError('messaging/invalid-registration-token')
          );
        }
        return null;
      })
    );

    expect(removeStub.calledOnce).to.equal(true, 'removed tokens once');
    const [, actualUser, actualTokens] = removeStub.firstCall.args;
    expect(actualUser).to.equal(userId);
    expect(actualTokens).to.deep.equal([unregistered, invalid]);
  });

  it('marks a message published when all of a users tokens are invalid', async () => {
    const { updates } = setupSinglePush();
    sinon.stub(regTokensModel, 'removeTokens').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(() =>
        Promise.reject(fcmError('messaging/registration-token-not-registered'))
      )
    );

    expect(updates[0].unpublishedPush).to.equal(0);
    expect(updates[0]['publishedMediums.push']).to.equal(true);
  });

  it('keeps a message for retry when sending fails temporarily', async () => {
    const { userId, updates } = setupSinglePush();
    const removeStub = sinon.stub(regTokensModel, 'removeTokens').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(() =>
        Promise.reject(fcmError('messaging/server-unavailable'))
      )
    );

    expect(updates[0].unpublishedPush).to.equal(1);
    expect(updates[0]).to.not.have.property(`push.${userId}`);
    expect(updates[0]).to.not.have.property('publishedMediums.push');
    expect(removeStub.called).to.equal(false, 'kept registration token');
  });

  it('abandons a temporarily failing message once it is a day old', async () => {
    const { userId, updates } = setupSinglePush({
      createdAt: mocking.nowUnix() - ONE_DAY_SEC - 1,
    });

    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(() =>
        Promise.reject(fcmError('messaging/server-unavailable'))
      )
    );

    expect(updates[0].unpublishedPush).to.equal(0);
    expect(updates[0]).to.have.property(`push.${userId}`);
  });

  it('does not send to a user who opted out after the message was created', async () => {
    const { userId, updates } = setupSinglePush({ user: { pushOptOut: true } });

    let sent = false;
    await createHandler(
      createFirestore(),
      createPubSubHandler(),
      'topic',
      createMessagingStub(() => {
        sent = true;
      })
    );

    expect(sent).to.equal(false, 'sent no message');
    expect(updates[0].unpublishedPush).to.equal(0);
    expect(updates[0]).to.have.property(`push.${userId}`);
  });
});
