const sinon = require('sinon');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions, messaging } = require('../setup');

const USER_ID = uuid();
const REG_TOKEN = uuid();
const REG_TOKEN_TWO = uuid();
const NOTIFICATION_ID = uuid();
const REG_TOKEN_PATH = `/registrationTokens/${USER_ID}/${REG_TOKEN}`;
const PUSH_NOTIFICATION_PATH = `/notifications/push/${NOTIFICATION_ID}`;
const NOTIFICATION_DATA = Object.freeze({
  title: 'notification',
  message: 'summary',
  user: USER_ID,
  createdAt: unixNow(),
});

describe('Publish Push notification', () => {
  afterEach(() => {
    sinon.restore();
    return cleanDb(db);
  });

  it('sends a push notification to all a users registered tokens', async () => {
    const actual = [];
    const expected = [REG_TOKEN, REG_TOKEN_TWO];

    // Stup Requests
    const stub = sinon.stub(messaging, 'sendToDevice');
    stub.callsFake(tokens => {
      actual.push(...tokens);
      return Promise.resolve({ multicastId: uuid() });
    });

    // Setup Database
    await db.ref(PUSH_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    await db.ref(REG_TOKEN_PATH).set(unixNow()); // Token one
    await db
      .ref(REG_TOKEN_PATH.replace(REG_TOKEN, REG_TOKEN_TWO))
      .set(unixNow()); // Token two

    // Execute
    await test.wrap(cloudFunctions.publishPushNotifications)();

    // Assertions
    expect(actual).to.deep.include(expected[0]);
    expect(actual).to.deep.include(expected[1]);
  });

  it('sends a push notification with the configured title and message', async () => {
    let actual = null;
    const expected = {
      title: NOTIFICATION_DATA.title,
      body: NOTIFICATION_DATA.message,
    };

    // Stup Requests
    const stub = sinon.stub(messaging, 'sendToDevice');
    stub.callsFake((_, payload) => {
      actual = payload.notification || {};
      return Promise.resolve({ multicastId: uuid() });
    });

    // Setup Database
    await db.ref(PUSH_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    await db.ref(REG_TOKEN_PATH).set(unixNow()); // Token one

    // Execute
    await test.wrap(cloudFunctions.publishPushNotifications)();

    // Assertions
    expect(actual.icon).to.be.a('string', 'has notification icon');
    delete actual.icon;
    expect(actual).to.deep.equal(expected);
  });

  it('removes a push notifiation record after successfully publishing it', async () => {
    const expected = false; // push notification does not exist

    // Stup Requests
    const stub = sinon.stub(messaging, 'sendToDevice');
    stub.callsFake(() => Promise.resolve({ multicastId: uuid() }));

    // Setup Database
    await db.ref(PUSH_NOTIFICATION_PATH).set(NOTIFICATION_DATA);
    await db.ref(REG_TOKEN_PATH).set(unixNow()); // Token one

    // Execute
    await test.wrap(cloudFunctions.publishPushNotifications)();

    // Assertions
    const snap = await db.ref(PUSH_NOTIFICATION_PATH).once('value');
    const actual = snap.exists();
    expect(actual).to.equal(expected);
  });
});

function unixNow() {
  return Math.round(Date.now() / 1000);
}
