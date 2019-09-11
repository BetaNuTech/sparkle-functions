const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnWriteHandler = require('./on-write-watcher');

describe('Templates', function() {
  describe('On Write', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const db = createDatabaseStub(
        {},
        { exists: () => true, val: () => ({}) }
      ).value();
      const actual = createOnWriteHandler(db)(
        {
          before: { exists: () => true, val: () => null },
          after: { exists: () => false, val: () => null },
        },
        { params: { templateId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then(result =>
        expect(result).to.be.an('object', 'has update hash')
      );
    });
  });
});
