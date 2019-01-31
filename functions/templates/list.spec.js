const { write, removeCategory } = require('./list');
const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');

describe('Templates List', () => {
  describe('Writing a template change', () => {
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

  describe('Removing a category', () => {
    it('should return a promise', () => {
      const actual = removeCategory(createDatabaseStub().value(), 'test');
      expect(actual).to.be.an.instanceof(Promise);
    });

    it('should resolve an update hash', () => {
      return removeCategory(
        createDatabaseStub({}, { exists: () => true, val: () => ({}) }).value(),
        'test'
      ).then((actual) =>
        expect(actual).to.be.an('object')
      )
    });
  });
});
