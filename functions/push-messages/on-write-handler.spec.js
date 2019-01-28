const sinon = require('sinon');
const { expect } = require('chai');
const createOnWriteHandler = require('./on-write-handler');
const { createDatabaseStub, createMessagingStub } = require('../test-helpers/firebase');
const uuid = require('../test-helpers/uuid');

describe('Push Messages', function() {
  describe('On Write Handler', function() {
    it('should create a handler that returns a promise resolving a boolean', () => {
      const actual = createOnWriteHandler(createDatabaseStub().value(), createMessagingStub().value())(
        { after: { exists: () => false } },
        {}
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.a('boolean', 'has boolean'));
    });

    it('should return immediately when message deleted', function() {
      return createOnWriteHandler(createDatabaseStub().value(), createMessagingStub().value())(
        { after: { exists: () => false } },
        {}
      ).then(actual => {
        expect(actual).to.equal(false);
      });
    });

    it('should not send message when recipient is undiscoverable', function() {
      let loaded = false;

      const db = createDatabaseStub({}, {
        exists: () => {
          loaded = true;
          return false;
        },
        hasChildren: () => {
          throw new Error('invokes `hasChildren`');
        }
      }).value();

      return createOnWriteHandler(db, createMessagingStub().value())({
        after: {
          exists: () => true,
          val: () => ({ recipientId: uuid() })
        }
      },
      { params: { objectId: uuid() } }
      )
        .then(() => expect(loaded).to.equal(true, 'loaded data snapshot successfully'));
    });

    it('should send notification to all a recipients\' devices', function() {
      let sentMessage = false;
      const expectedTokens = [uuid(), uuid()];

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

      const db = createDatabaseStub({}, {
        exists: () => true,
        hasChildren: () => true,
        forEach: (fn) => {
          expectedTokens.forEach(id => fn({ key: id }));
        }
      }).value();

      const messaging = createMessagingStub({}, {
        sendToDevice: (actualToken, actualPayload) => {
          expect(expectedTokens).to.deep.equal(actualToken, 'sent to all registered tokens');
          expect(expectedPayload.title).to.equal(actualPayload.notification.title, 'sent message title');
          expect(expectedPayload.message).to.equal(actualPayload.notification.body, 'sent message body');
          sentMessage = true;
          return Promise.resolve('done');
        }
      }).value();

      return createOnWriteHandler(db, messaging)(
        payload,
        { params: { objectId: expectedPayload.recipientId } }
      )
        .then(() => expect(sentMessage).to.equal(true, 'triggered send message successfully'));
    });

    it('should send notification to a recipients\' single device', function() {
      let sentMessage = false;
      const expectedToken = uuid();
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

      const db = createDatabaseStub({}, {
        exists: () => true,
        hasChildren: () => false,
        key: expectedToken
      }).value();

      const messaging = createMessagingStub({}, {
        sendToDevice: (actualToken, actualPayload) => {
          expect([expectedToken]).to.deep.equal(actualToken, 'sent to the registered token');
          expect(expectedPayload.title).to.equal(actualPayload.notification.title, 'sent message title');
          expect(expectedPayload.message).to.equal(actualPayload.notification.body, 'sent message body');
          sentMessage = true;
          return Promise.resolve('done');
        }
      }).value();

      return createOnWriteHandler(db, messaging)(
        payload,
        { params: { objectId: uuid() } }
      )
        .then(() => expect(sentMessage).to.equal(true, 'triggered send message successfully'));
    });
  });
});
