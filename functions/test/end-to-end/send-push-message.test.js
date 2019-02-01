const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Send Push Message', () => {
  afterEach(() => cleanDb(db));

  it('should remove a message after sending to its\' recipients', () => co(function *() {
    const msgId = uuid();
    const messagePath = `/sendMessages/${msgId}`;
    const messageData = { createdAt: Date.now() / 1000, message: 'message', title: 'title', recipientId: uuid() };
    yield db.ref(messagePath).set(messageData);
    const message = yield db.ref(messagePath).once('value');
    const messageSnap = test.makeChange(null, message);
    const wrapped = test.wrap(cloudFunctions.sendPushMessage);

    yield wrapped(messageSnap, { params: { objectId: msgId } });
    const actual = yield db.ref(messagePath).once('value');
    expect(actual.exists()).to.equal(false);
  }));
});
