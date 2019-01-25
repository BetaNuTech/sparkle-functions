const { expect } = require('chai');
const { createPublishHandler } = require('./index');
const uuid = require('../test-helpers/uuid');
const {
  createPubSubStub,
  createDatabaseStub
} = require('../test-helpers/firebase');

describe('Inspections Module', () => {
  describe('On Publish', () => {
    it('should resolve a hash of updates', () => {
      const actual = createPublishHandler('test', createPubSubStub(), createDatabaseStub());
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
    });
  });
});
