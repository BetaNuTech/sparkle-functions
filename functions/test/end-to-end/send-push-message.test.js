const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Send Push Message', () => {
  afterEach(() => cleanDb(db));

  it('should remove a message after sending to its\' recipients', () => co(function *() {
    const messageId = uuid();
    const messagePath = `/sendMessages/${messageId}`;
    const messageData = { createdAt: Date.now() / 1000, message: 'message', title: 'title', recipientId: uuid() };

    // Setup database
    yield db.ref(messagePath).set(messageData);
    const message = yield db.ref(messagePath).once('value');
    const messageSnap = test.makeChange(null, message);

    // Execute
    const wrapped = test.wrap(cloudFunctions.sendPushMessage);
    yield wrapped(messageSnap, { params: { messageId } });

    // Test result
    const actual = yield db.ref(messagePath).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  }));
});
