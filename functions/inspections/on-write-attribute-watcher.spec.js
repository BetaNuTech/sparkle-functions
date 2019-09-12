const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnAttributeWriteHandler = require('./on-write-attribute-watcher');

describe('Inspections', function() {
  describe('On Attribute Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = createOnAttributeWriteHandler(
        createDatabaseStub().value()
      )(
        {
          before: { exists: () => true },
          after: { exists: () => false },
        },
        { params: { inspectionId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then(result =>
        expect(result).to.be.an('object', 'has update hash')
      );
    });
  });
});
