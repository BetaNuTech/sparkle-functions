const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, pubsub, cloudFunctions } = require('../setup');

const USER_ID = uuid();
const TEAM_ID = uuid();
const RECIPIENT_ID = uuid();
const PROPERTY_ID = uuid();
const NOTIFICATION_ID = uuid();
const REG_TOKEN_PATH = `/registrationTokens/${USER_ID}/${RECIPIENT_ID}`;
const USER_TWO_ID = uuid();
const RECIPIENT_TWO_ID = uuid();
const REG_TOKEN_TWO_PATH = `/registrationTokens/${USER_TWO_ID}/${RECIPIENT_TWO_ID}`;
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
        `did ${
          expected ? '' : 'not '
        }create push notification for user with permission level: ${
          data.firstName
        }`
      );

      await db.ref(PUSH_NOTIFICATION_PATH).remove(); // Cleanup
    }
  });

  it('creates push notifications for permissioned users for a property notification', async () => {
    const userTests = [
      {
        data: { firstName: 'no permission' },
        expected: false,
      },
      {
        data: {
          firstName: 'associated property level',
          properties: { [PROPERTY_ID]: true },
        },
        expected: true,
      },
      {
        data: {
          firstName: 'unassociated property level',
          properties: { [uuid()]: true },
        },
        expected: false,
      },
      {
        data: {
          firstName: 'associated team lead',
          teams: { [TEAM_ID]: { [PROPERTY_ID]: true } },
        },
        expected: true,
      },
      {
        data: {
          firstName: 'unassociated team lead',
          teams: { [TEAM_ID]: { [uuid()]: true } },
        },
        expected: false,
      },
      {
        data: { firstName: 'corporate', corporate: true },
        expected: true,
      },
      {
        data: { firstName: 'admin', admin: true },
        expected: true,
      },
    ];

    // Setup source property notification
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({ property: PROPERTY_ID }, NOTIFICATION_DATA));
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
        `did ${
          expected ? '' : 'not '
        }create push notification for user with permission level: ${
          data.firstName
        }`
      );

      await db.ref(PUSH_NOTIFICATION_PATH).remove(); // Cleanup
    }
  });

  it('creates a push notification for each intended recipient', async () => {
    const expected = 2; // one for each user

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(`/users/${USER_ID}`).set({ admin: true });
    await db.ref(`/users/${USER_TWO_ID}`).set({ admin: true });
    await db.ref(REG_TOKEN_PATH).set(unixNow());
    await db.ref(REG_TOKEN_TWO_PATH).set(unixNow());

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourcePushNotification);
      await wrapped(srcSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const snap = await db.ref(PUSH_NOTIFICATION_PATH).once('value');
    const actual = Object.keys(snap.val() || {}).length;
    expect(actual).to.equal(expected, 'has notification for each recipient');
  });

  it('does not create push notifications for users that opted out', async () => {
    const expected = false; // Does not create any notifications

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(`/users/${USER_ID}`).set({ admin: true, pushOptOut: true });
    await db.ref(REG_TOKEN_PATH).set(unixNow());

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourcePushNotification);
      await wrapped(srcSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const snap = await db.ref(PUSH_NOTIFICATION_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(expected, 'did not create notification');
  });

  it('updates the source notification\'s published mediums with "push"', async () => {
    const expected = true;

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(`/users/${USER_ID}`).set({ admin: true });
    await db.ref(REG_TOKEN_PATH).set(unixNow());

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourcePushNotification);
      await wrapped(srcSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const snap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    const actual = ((snap.val() || {}).publishedMediums || {}).slack;
    expect(actual).to.equal(expected);
  });

  it('publishs a push notifications sync event', async () => {
    let actual = false;
    const expected = true;
    const unsubscribe = pubsub.subscribe('push-messages-sync', () => {
      actual = true;
    });

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    const srcSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(`/users/${USER_ID}`).set({ admin: true });
    await db.ref(REG_TOKEN_PATH).set(unixNow());

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourcePushNotification);
      await wrapped(srcSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    expect(actual).to.equal(expected);

    // Cleanup
    unsubscribe();
  });
});

function unixNow() {
  return Math.round(Date.now() / 1000);
}
