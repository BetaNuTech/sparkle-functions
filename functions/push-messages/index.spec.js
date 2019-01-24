const { expect } = require('chai');
const { createPublishHandler } = require('./index');
const uuid = require('../test-helpers/uuid');

describe('Push Messages Module', () => {
  describe('On Publish', () => {
    it('should resolve a hash of updates', () => {
      const actual = createPublishHandler('test', stubPubSub(), stubDb());
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
    });

    it('should resend each discovered message', () => {
      const id1 = uuid();
      const id2 = uuid();
      const db =  stubDb({ [id1]: {}, [id2]: {} });
      const actual = createPublishHandler('test', stubPubSub(), db);
      return actual.then((result) => {
        expect(result).to.have.property(id1);
        expect(result).to.have.property(id2);
      });
    });
  });
});

function stubPubSub() {
  return {
    topic: () => ({
      onPublish: (fn) => fn()
    })
  };
}

function stubDb(payload = {}) {
  return {
    ref() {
      return this;
    },
    child() {
      return this;
    },
    update: () => Promise.resolve(),
    once() {
      return Promise.resolve({
        val: () => payload,
        toJSON: () => payload,
        hasChildren: () => true,
        exists: () => true
      });
    }
  };
}
