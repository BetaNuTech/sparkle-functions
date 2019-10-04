const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, pubsub, cloudFunctions } = require('../setup');

const PROPERTY_ID = uuid();
const NOTIFICATION_ID = uuid();
const SRC_NOTIFICATION_PATH = `/notifications/src/${NOTIFICATION_ID}`;
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

describe('Create Slack Notification From Source', () => {
  afterEach(() => cleanDb(db));

  it('should not create a admin slack notification when admin channel is not set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, NOTIFICATION_DATA));
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

  it('should not create a property slack notification when property channel is not set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({ property: PROPERTY_ID }, NOTIFICATION_DATA));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
      await wrapped(notificationsSnap, {
        params: { notificationId: NOTIFICATION_ID },
      });
    } catch (err) {} // eslint-disable-line no-empty

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

  it('should not create a slack notification when it was previously created', async () => {
    const notificationData = Object.assign(
      {
        publishedMediums: { slack: true },
      },
      NOTIFICATION_DATA
    );

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(notificationData);
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

  it('should create an admin slack notification when admin channel is set', async () => {
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

  it('should create a property slack notification when property channel is set', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({ property: PROPERTY_ID }, NOTIFICATION_DATA));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db.ref(SLACK_PROP_NOTIFICATON_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(true);
  });

  it('should create a slack notification using any markdown content instead of the summary', async () => {
    const expected = '# Mark it down!';
    const markdownNotification = Object.assign(
      { markdownBody: expected },
      NOTIFICATION_DATA
    );

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(markdownNotification);
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db
      .ref(`${SLACK_ADMIN_NOTIFICATON_PATH}/message`)
      .once('value');
    const actual = snap.val();
    expect(actual).to.equal(expected);
  });

  it('should mark the source notifications published mediums to include slack', async () => {
    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db
      .ref(`${SRC_NOTIFICATION_PATH}/publishedMediums/slack`)
      .once('value');
    const actual = snap.val();
    expect(actual).to.equal(true);
  });

  it("marks source notification's published mediums with slack when admin channel is not configured", async () => {
    const expected = true; // has slack published medium

    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, NOTIFICATION_DATA));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db
      .ref(`${SRC_NOTIFICATION_PATH}/publishedMediums/slack`)
      .once('value');
    const actual = snap.val();
    expect(actual).to.equal(expected);
  });

  it("marks source notification's published mediums with slack when property channel is not configured", async () => {
    const expected = true; // has slack published medium

    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, NOTIFICATION_DATA, { property: PROPERTY_ID }));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    const snap = await db
      .ref(`${SRC_NOTIFICATION_PATH}/publishedMediums/slack`)
      .once('value');
    const actual = snap.val();
    expect(actual).to.equal(expected);
  });

  it('should publish a notifications sync event for the slack channel', async () => {
    let actual = '';
    const expected = SLACK_ORG_INTEGRATION_DATA.defaultChannelName;
    const unsubscribe = pubsub.subscribe('notifications-slack-sync', data => {
      actual = Buffer.from(data, 'base64').toString();
    });

    // Setup database
    await db.ref(SRC_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    await db.ref(SLACK_ORG_INTEGRATION_PATH).set(SLACK_ORG_INTEGRATION_DATA);
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.onCreateSourceSlackNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    expect(actual).to.equal(expected);

    // Cleanup
    unsubscribe();
  });
});
