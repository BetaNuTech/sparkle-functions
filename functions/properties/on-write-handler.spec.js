const sinon = require('sinon');
const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnWriteHandler = require('./on-write-handler');

describe('Properties', function() {
  describe('On Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = createOnWriteHandler(createDatabaseStub().value())(
        {
          before: { exists: () => true, val: () => ({ templates: null }) },
          after: { exists: () => false }
        },
        { params: { objectId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
    });
  });
});
