const sinon = require('sinon');
const { expect } = require('chai');
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();
const { createDatabaseStub, createMessagingStub } = require('./test-helpers/firebase');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe('Push Messages', function() {
  let cloudFunctions, adminInitStub;

  before(() => {
    // Stub admin.initializeApp to avoid live database access
    if (!admin.initializeApp.isSinonProxy) {
      adminInitStub = sinon.stub(admin, 'initializeApp').returns({
        database: () => admin
      });
    }
    cloudFunctions = require('./index');
  });

  describe('Send On Write', function() {
    let oldDatabase;
    before(() => oldDatabase = admin.database);
    after(() => admin.database = oldDatabase);

    it('should return immediately when message deleted', function() {
      const wrapped = test.wrap(cloudFunctions.sendPushMessage);
      const payload = { after: { exists: () => false } };
      return expect(wrapped(payload)).to.equal(false);
    });

    it('should send message when recipient is undiscoverable', function() {
      let loaded = false;
      const wrapped = test.wrap(cloudFunctions.sendPushMessage);
      const payload = {
        after: {
          exists: () => true,
          val: () => ({ recipientId: uuid() })
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => {
            loaded = true;
            return false;
          },
          hasChildren: () => {
            throw new Error('invokes `hasChildren`');
          }
        })
      );

      return wrapped(payload, { params: { objectId: uuid() } })
        .then(() => expect(loaded).to.equal(true, 'loaded data snapshot successfully'));
    });

    it('should send notification to all a recipients\' devices', function() {
      let sentMessage = false;
      const expectedTokens = [uuid(), uuid()];
      const wrapped = test.wrap(cloudFunctions.sendPushMessage);
      const expectedPayload = {
        recipientId: uuid(),
        title: `title-${uuid()}`,
        message: `body-${uuid()}`
      };
      const payload = {
        after: {
          exists: () => true,
          val: () => expectedPayload
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          hasChildren: () => true,
          forEach: (fn) => {
            expectedTokens.forEach(id => fn({ key: id }));
          }
        })
      );

      Object.defineProperty(
        admin,
        'messaging',
        createMessagingStub({}, {
          sendToDevice: (actualToken, actualPayload) => {
            expect(expectedTokens).to.deep.equal(actualToken, 'sent to all registered tokens');
            expect(expectedPayload.title).to.equal(actualPayload.notification.title, 'sent message title');
            expect(expectedPayload.message).to.equal(actualPayload.notification.body, 'sent message body');
            sentMessage = true;
            return Promise.resolve();
          }
        })
      );

      return wrapped(payload, { params: { objectId: expectedPayload.recipientId } })
        .then(() => expect(sentMessage).to.equal(true, 'triggered send message successfully'));
    });

    it('should send notification to a recipients\' single device', function() {
      let sentMessage = false;
      const expectedToken = uuid();
      const wrapped = test.wrap(cloudFunctions.sendPushMessage);
      const expectedPayload = {
        recipientId: uuid(),
        title: `title-${uuid()}`,
        message: `body-${uuid()}`
      };
      const payload = {
        after: {
          exists: () => true,
          val: () => expectedPayload
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          hasChildren: () => false,
          key: expectedToken
        })
      );

      Object.defineProperty(
        admin,
        'messaging',
        createMessagingStub({}, {
          sendToDevice: (actualToken, actualPayload) => {
            expect([expectedToken]).to.deep.equal(actualToken, 'sent to the registered token');
            expect(expectedPayload.title).to.equal(actualPayload.notification.title, 'sent message title');
            expect(expectedPayload.message).to.equal(actualPayload.notification.body, 'sent message body');
            sentMessage = true;
            return Promise.resolve();
          }
        })
      );

      return wrapped(payload, { params: { objectId: uuid() } })
        .then(() => expect(sentMessage).to.equal(true, 'triggered send message successfully'));
    });

    it('should remove the message after sendToDevice() is attempted', function() {
      let removedMessage = false;
      const expected = uuid();
      const wrapped = test.wrap(cloudFunctions.sendPushMessage);
      const payload = {
        after: {
          exists: () => true,
          val: () => ({
            recipientId: uuid(),
            title: `title-${uuid()}`,
            message: `body-${uuid()}`
          })
        }
      };

      // Setup stubbed database/messaging
      const snapshot = {
        exists: () => true,
        hasChildren: () => false,
        key: uuid()
      };

      let childLookups = 0;
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, snapshot, {
          child: (actual) => {
            childLookups++;
            if (childLookups === 2) {
              expect(expected).to.equal(actual);
            }

            return {
              once: () => Promise.resolve(snapshot),
              remove: () => {
                removedMessage = true;
                return Promise.resolve();
              }
            };
          }
        })
      );

      Object.defineProperty(
        admin,
        'messaging',
        createMessagingStub({}, {
          // Add randomness to send message result
          sendToDevice: () => Math.random() > .5 ? Promise.resolve() : Promise.reject()
        })
      );

      return wrapped(payload, { params: { objectId: expected } })
      .then(() => {
        expect(removedMessage).to.equal(true, 'triggered remove of sendMessage')
      });
    });
  });
});
