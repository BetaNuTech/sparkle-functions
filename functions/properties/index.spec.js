const sinon = require('sinon');
const { expect } = require('chai');
const { templatesOnWriteHandler } = require('./index');
const { createDatabaseStub } = require('../test-helpers/firebase');

describe('Property', function() {
  describe('On Write Template', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = templatesOnWriteHandler(createDatabaseStub().value())(
        {
          before: { exists: () => true },
          after: { exists: () => false }
        },
        { params: { objectId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then((result) => expect(result).to.be.an('object', 'has update hash'))
    });
  });
});
