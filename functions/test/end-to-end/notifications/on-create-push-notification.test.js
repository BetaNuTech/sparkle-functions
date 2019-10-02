const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test /* pubsub, */, cloudFunctions } = require('../setup');

const NOTIFICATION_ID = uuid();
const SRC_NOTIFICATION_PATH = `/notifications/src/${NOTIFICATION_ID}`;
const PUSH_NOTIFICATION_PATH = '/notifications/push';
// const NOTIFICATION_DATA = Object.freeze({
//   title: 'notification',
//   summary: 'summary',
// });

describe('Create Push Notification From Source', () => {
  afterEach(() => cleanDb(db));

  it('should not create a push notification when missing a title or summary', async () => {
    const notificationsData = [
      { title: 'missing summary' },
      { summary: 'missing title' },
    ];

    for (let i = 0; i < notificationsData.length; i++) {
      // Setup database
      const data = notificationsData[i];
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
});
