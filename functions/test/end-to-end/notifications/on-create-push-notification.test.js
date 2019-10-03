const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test /* pubsub, */, cloudFunctions } = require('../setup');

const USER_ID = uuid();
const TEAM_ID = uuid();
const RECIPIENT_ID = uuid();
const PROPERTY_ID = uuid();
const NOTIFICATION_ID = uuid();
const REG_TOKEN_PATH = `/registrationTokens/${USER_ID}/${RECIPIENT_ID}`;
const SRC_NOTIFICATION_PATH = `/notifications/src/${NOTIFICATION_ID}`;
const PUSH_NOTIFICATION_PATH = '/notifications/push';
const NOTIFICATION_DATA = Object.freeze({
  title: 'notification',
  summary: 'summary',
});

describe('Create Push Notification From Source', () => {
  afterEach(() => cleanDb(db));

  it('should not create a push notification when missing a title or summary', async () => {
    const notificationTests = [
      { title: 'missing summary' },
      { summary: 'missing title' },
    ];

    // Setup user and registration token
    await db.ref(REG_TOKEN_PATH).set(unixNow());
    await db.ref(`/users/${USER_ID}`).set({ admin: true });

    for (let i = 0; i < notificationTests.length; i++) {
      // Setup database
      const data = notificationTests[i];
      await db.ref(SRC_NOTIFICATION_PATH).set(data);
      const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

      // Execute
      try {
        const wrapped = test.wrap(
          cloudFunctions.onCreateSourcePushNotification
        );
        await wrapped(srcSnap, {
          params: { notificationId: NOTIFICATION_ID },
        });
      } catch (err) {} // eslint-disable-line no-empty

      // Assertions
      const snap = await db.ref(PUSH_NOTIFICATION_PATH).once('value');
      const actual = snap.exists();
      expect(actual).to.equal(
        false,
        `did not create push notification when ${data.title || data.summary}`
      );
    }
  });

  it('creates push notifications for permissioned users for a default notification', async () => {
    const userTests = [
      {
        data: { firstName: 'no permission' },
        expected: false,
      },
      {
        data: {
          firstName: 'property level',
          properties: { [PROPERTY_ID]: true },
        },
        expected: false,
      },
      {
        data: {
          firstName: 'team lead',
          teams: { [TEAM_ID]: { [PROPERTY_ID]: true } },
        },
        expected: false,
      },
      {
        data: { firstName: 'corporate', corporate: true },
        expected: false,
      },
      {
        data: { firstName: 'admin', admin: true },
        expected: true,
      },
    ];

    // Setup source notification
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Setup user's registration token
    await db.ref(REG_TOKEN_PATH).set(unixNow());

    for (let i = 0; i < userTests.length; i++) {
      const { expected, data } = userTests[i];

      // Setup database
      await db.ref(`/users/${USER_ID}`).set(data);

      // Execute
      try {
        const wrapped = test.wrap(
          cloudFunctions.onCreateSourcePushNotification
        );
        await wrapped(srcSnap, {
          params: { notificationId: NOTIFICATION_ID },
        });
      } catch (err) {} // eslint-disable-line no-empty

      // Assertions
      const snap = await db.ref(PUSH_NOTIFICATION_PATH).once('value');
      const actual = snap.exists();
      expect(actual).to.equal(
        expected,
        `did ${expected ? '' : 'not '}create push notification for ${
          data.firstName
        }`
      );

      await db.ref(PUSH_NOTIFICATION_PATH).remove(); // Cleanup
    }
  });

  // it('creates push notifications for permissioned users for a property notification', async () => {})
  // it('updates the source notifications published mediums with "push"', async () => {});
  // it('publishs a notifications sync event for the slack channel', async () => {});
});

function unixNow() {
  return Math.round(Date.now() / 1000);
}
