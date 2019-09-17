const { expect } = require('chai');
// const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const {
  db,
  test,
  // pubsub,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../setup');

const PROPERTY_ID = uuid();
const NOTIFICATION_ID = uuid();
const SRC_NOTIFICATION_PATH = `/notifications/source/${NOTIFICATION_ID}`;
const SYSTEM_INTEGRATION_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}`;
const SLACK_SYSTEM_PATH = `${SYSTEM_INTEGRATION_PATH}/slack/organization`;
const SLACK_ORG_INTEGRATION_PATH = '/integrations/slack/organization';
const SLACK_ORG_INTEGRATION_DATA = { defaultChannelName: 'admin-channel' };
const PROPERTY_PATH = `/properties/${PROPERTY_ID}`;
const PROPERTY_DATA = { slackChannel: 'property-channel' };
const SLACK_ADMIN_NOTIFICATON_PATH = `/notifications/slack/${SLACK_ORG_INTEGRATION_DATA.defaultChannelName}/${NOTIFICATION_ID}`;
const SLACK_PROP_NOTIFICATON_PATH = `/notifications/slack/${PROPERTY_DATA.slackChannel}/${NOTIFICATION_ID}`;
const NOTIFICATION_DATA = Object.freeze({
  title: 'notification',
  summary: 'summary',
});
const SLACK_SYSTEM_DATA = {
  accessToken: 'lfjkas',
  scope: 'all',
};

describe('On create source notification', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(SYSTEM_INTEGRATION_PATH).remove();
  });

  it('should not create a admin slack notification when admin channel is not set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, NOTIFICATION_DATA));
    await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db.ref(SLACK_ADMIN_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(false);
  });

  it('should not create a property slack notification when property channel is not set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({ property: PROPERTY_ID }, NOTIFICATION_DATA));
    await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db.ref(SLACK_PROP_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(false);
  });

  it('should not create a slack notification when source notification is missing a title', async () => {
    const invalidNotificationData = Object.assign({}, NOTIFICATION_DATA);
    delete invalidNotificationData.title;

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(invalidNotificationData);
    await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
      await wrapped(notificationsSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const snap = await db.ref(SLACK_ADMIN_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(false);
  });

  it('should not create a slack notification when source notification is missing a summary', async () => {
    const invalidNotificationData = Object.assign({}, NOTIFICATION_DATA);
    delete invalidNotificationData.summary;

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(invalidNotificationData);
    await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
      await wrapped(notificationsSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const snap = await db.ref(SLACK_ADMIN_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(false);
  });

  // it('should create an admin slack notification when slack is setup', async () => {
  //   // Setup database
  //   await db
  //     .ref(SRC_NOTIFICATION_PATH)
  //     .set(Object.assign({}, NOTIFICATION_DATA));
  //   const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
  //   await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
  //   await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
  //
  //   // Execute
  //   const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
  //   await wrapped(notificationsSnap, {
  //     params: { notificationId: NOTIFICATION_ID },
  //   });
  //
  //   // Assertions
  //   const snap = await db.ref(SLACK_ADMIN_NOTIFICATON_PATH).once('value');
  //   const actual = snap.exists();
  //   expect(actual).to.equal(true);
  // });
  //
  // it('should create a property slack notification when slack is setup and property has a channel', async () => {
  //   // Setup database
  //   await db
  //     .ref(SRC_NOTIFICATION_PATH)
  //     .set(Object.assign({ property: PROPERTY_ID }, NOTIFICATION_DATA));
  //   const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
  //   await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);
  //   await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
  //
  //   // Execute
  //   const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
  //   await wrapped(notificationsSnap, {
  //     params: { notificationId: NOTIFICATION_ID },
  //   });
  //
  //   // Assertions
  //   const snap = await db.ref(SLACK_PROP_NOTIFICATON_PATH).once('value');
  //   const actual = snap.exists();
  //   expect(actual).to.equal(true);
  // });
});
