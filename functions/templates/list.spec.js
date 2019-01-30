const { write } = require('./list');
const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');

describe('Templates List', () => {
  describe('Write template change', () => {
    it('should return a promise', () => {
      const actual = write(createDatabaseStub().value(), 'test', {}, null);
      expect(actual).to.be.an.instanceof(Promise);
    });

    it('should resolve `null` on template deletion', () => {
      return write(
        createDatabaseStub().value(),
        'test',
        { name: 'test' },
        null // removed
      ).then((actual) =>
        expect(actual).to.equal(null)
      )
    });

    it('should resolve upserted data on template upsert', () => {
      const expected = { name: 'test-2', description: 'desc-2' };

      return write(
        createDatabaseStub().value(),
        'test',
        { name: 'test', description: 'desc' },
        expected // update
      ).then((actual) =>
        expect(actual).to.deep.equal(expected)
      )
    });
  });
});
