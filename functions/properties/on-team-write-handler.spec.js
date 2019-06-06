const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnTeamsWriteHandler = require('./on-team-write-handler');

describe('Properties', function() {
  describe('On Team Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = createOnTeamsWriteHandler(createDatabaseStub().value())(
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
