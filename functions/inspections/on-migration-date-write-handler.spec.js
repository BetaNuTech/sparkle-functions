const sinon = require('sinon');
const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnMigrationDateWriteHandler = require('./on-migration-date-write-handler');

describe('Inspections', function() {
  describe('On Migration Date Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = createOnMigrationDateWriteHandler(createDatabaseStub().value())(
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
