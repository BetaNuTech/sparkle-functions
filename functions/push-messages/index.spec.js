const { expect } = require('chai');
const { createPublishHandler } = require('./index');

describe('Push Messages Module', () => {
  describe('On Publish', () => {
    it('should resolve a hash of updates', () => {
      const actual = createPublishHandler('test', stubPubSub(), stubDb());
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
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

function stubDb() {
  return {};
}
