const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');
const createOnTeamsWriteHandler = require('./on-team-write-watcher');

describe('Properties', function() {
  describe('On Team Write Handler', function() {
    it('should create a handler that returns a promise resolving updates hash', () => {
      const actual = createOnTeamsWriteHandler(
        createDatabaseStub().value(),
        createPubSubClient(),
        'topic'
      )(
        {
          before: { exists: () => true, val: () => ({}) },
          after: { exists: () => false, val: () => null },
        },
        { params: { propertyId: '1' } }
      );
      expect(actual).to.be.an.instanceof(Promise, 'returned a promise');
      return actual.then(result =>
        expect(result).to.be.an('object', 'has update hash')
      );
    });
  });
});

function createPubSubClient() {
  return {
    topic: () => ({
      publisher: () => ({
        publish: () => Promise.resolve(),
      }),
    }),
  };
}
