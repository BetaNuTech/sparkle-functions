const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Send Push Message', () => {
  afterEach(() => cleanDb(db));

  it("should remove a message after sending to its' recipients", async () => {
    const messageId = uuid();
    const messagePath = `/sendMessages/${messageId}`;
    const messageData = {
      createdAt: Date.now() / 1000,
      message: 'message',
      title: 'title',
      recipientId: uuid(),
    };

    // Setup database
    await db.ref(messagePath).set(messageData);
    const message = await db.ref(messagePath).once('value');
    const messageSnap = test.makeChange(null, message);

    // Execute
    const wrapped = test.wrap(cloudFunctions.sendPushMessage);
    await wrapped(messageSnap, { params: { messageId } });

    // Test result
    const actual = await db.ref(messagePath).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  });
});
