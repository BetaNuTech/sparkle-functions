const sinon = require('sinon');
const { expect } = require('chai');
const templatesOnWriteHandler = require('./on-templates-write-handler');
const { createDatabaseStub } = require('../test-helpers/firebase');

describe('Properties', function() {
  describe('On Templates Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = templatesOnWriteHandler(createDatabaseStub().value())(
        {
          before: { exists: () => true },
          after: { exists: () => false }
        },
        { params: { propertyId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
    });
  });
});
