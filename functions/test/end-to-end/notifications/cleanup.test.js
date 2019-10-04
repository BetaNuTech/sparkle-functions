const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../setup');

const NOTIFICATION_ID = uuid();
const SRC_NOTIFICATION_PATH = `/notifications/src/${NOTIFICATION_ID}`;
const SLACK_ORG_INTEGRATION_PATH = '/integrations/slack/organization';
const SLACK_ORG_INTEGRATION_DATA = { defaultChannelName: 'admin-channel' };
const SLACK_ADMIN_NOTIFICATON_PATH = `/notifications/slack/${SLACK_ORG_INTEGRATION_DATA.defaultChannelName}/${NOTIFICATION_ID}`;
const NOTIFICATION_DATA = Object.freeze({
  title: 'notification',
  summary: 'summary',
});

describe('Cleanup Notifications', () => {
  afterEach(() => cleanDb(db));

  it('should remove notifications that are published to all mediums', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(
        Object.assign(
          { publishedMediums: { slack: true, push: true } },
          NOTIFICATION_DATA
        )
      );

    // Execute
    await test.wrap(cloudFunctions.cleanupNotifications)();

    // Test results
    const snap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    const actual = snap.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it('should create a slack notification when admin channel is set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, NOTIFICATION_DATA));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db.ref(SLACK_ADMIN_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(true);
  });
});
