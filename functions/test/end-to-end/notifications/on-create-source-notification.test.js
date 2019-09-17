const { expect } = require('chai');
// const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
// const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const {
  db,
  test,
  // pubsub,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../setup');

const NOTIFICATION_ID = uuid();
const SRC_NOTIFICATION_PATH = `/notifications/source/${NOTIFICATION_ID}`;
const SYSTEM_INTEGRATION_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}`;
const SLACK_SYSTEM_PATH = `${SYSTEM_INTEGRATION_PATH}/slack/organization`;
const SLACK_ORG_INTEGRATION_PATH = '/integrations/slack/organization';
const SLACK_ORG_INTEGRATION_DATA = {
  defaultChannelName: 'channel',
};
const DEFAULT_NOTIFICATION_DATA = Object.freeze({
  title: 'notification',
  summary: 'summary',
});
const SLACK_SYSTEM_DATA = {
  accessToken: 'lfjkas',
  scope: 'all'
};

describe('On create source notification', () => {
  afterEach(async () => {
    await cleanDb(db);
    return db.ref(SYSTEM_INTEGRATION_PATH).remove();
  });

  it('should not create a admin slack notification when slack is not setup', async () => {
    // Setup database
    await db
      .ref(SRC_NOTIFICATION_PATH)
      .set(Object.assign({}, DEFAULT_NOTIFICATION_DATA));
    const notificationsSnap = await db.ref(SRC_NOTIFICATION_PATH).once('value');

    // Execute /wo system integration
    const wrapped = test.wrap(cloudFunctions.onCreateSourceNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    let snap = await db.ref('/notifications/slack').once('value');
    let actual = snap.exists();
    expect(actual).to.equal(false, 'missing system integration');

    // Setup system's Slack credentials
    // without configuring admin channel
    await db.ref(SLACK_SYSTEM_PATH).set(SLACK_SYSTEM_DATA);

    // Execute /wo client slack integration
    await wrapped(notificationsSnap, {
      params: { notificationId: NOTIFICATION_ID },
    });

    // Assertions
    snap = await db.ref('/notifications/slack').once('value');
    actual = snap.exists();
    expect(actual).to.equal(false, 'missing client integration');
  });

  // it('should create an admin slack notification when slack is setup', async () => {
  //   const ref = db.ref('/notifications/source').push();
  //   const path = ref.path.toString();
  //   const notificationsId = path.split('/').pop();
  //
  //   // Setup database
  //   const notificationsSnap = await db.ref(path).once('value');
  //   const wrapped = test.wrap(cloudFunctions.onCreateSourceNotification);
  //   await wrapped(notificationsSnap, { params: { notificationsId } });
  // });

  // it("should create a property slack notification when the organization and property have it setup", async () => {
  // });
});
