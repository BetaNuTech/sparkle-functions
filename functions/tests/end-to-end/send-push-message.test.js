const co = require('co');
const test = require('firebase-functions-test')({
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'test-sapphire-inspections-8a9e3.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3',
}, '../auth.json');
const sinon = require('sinon');
const admin = require('firebase-admin');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
admin.initializeApp();
const db = admin.database();

describe('Send Push Message', () => {
  var cloudFunctions, oldDatabase;

  before(() => {
    // Stub admin.initializeApp to avoid live database access
    if (!admin.initializeApp.isSinonProxy) {
      adminInitStub = sinon.stub(admin, 'initializeApp').returns({ database: () => db });
      oldDatabase = admin.database;
      Object.defineProperty(admin, 'database', { writable: true, value: () => db });
    }
    cloudFunctions = require('../../index');
  });
  after(() => admin.database = oldDatabase);
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
