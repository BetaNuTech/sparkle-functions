const { expect } = require('chai');
const {
  createDatabaseStub,
  createFirestoreStub,
} = require('../../test-helpers/firebase');
const { write, removeCategory, removeOrphans } = require('./list');

describe('Templates List', () => {
  describe('Writing a template change', () => {
    it('should return a promise', () => {
      const actual = write(
        createDatabaseStub().value(),
        createFirestoreStub(),
        'test',
        {},
        null
      );
      expect(actual).to.be.an.instanceof(Promise);
    });

    it('should resolve `null` on template deletion', () =>
      write(
        createDatabaseStub().value(),
        createFirestoreStub(),
        'test',
        { name: 'test' },
        null // removed
      ).then(actual => expect(actual).to.equal(null)));

    it('should reject template without name', () =>
      write(
        createDatabaseStub().value(),
        createFirestoreStub(),
        'test',
        { name: 'before' },
        { name: '' } // New template has no name
      )
        .then(() => expect(true).to.equal(false, 'should not resolve'))
        .catch(e => expect(e).to.be.instanceof(Error, 'rejected with error')));

    it('should resolve upserted data on template upsert', () => {
      const tests = [
        { name: 'test-1', category: null },
        { name: 'test-2', description: 'desc-2', category: null },
        { name: 'test-3', category: 'category-3' },
        { name: 'test-4', category: 'category-4', description: 'desc-4' },
      ].map((expected, i) =>
        write(
          createDatabaseStub().value(),
          createFirestoreStub(),
          `test-${i}`,
          { name: 'test' }, // before
          expected // update
        ).then(actual =>
          expect(actual).to.deep.equal(expected, `test case ${i} updated`)
        )
      );

      return Promise.all(tests);
    });
  });

  describe('Removing a category', () => {
    it('should return a promise', () => {
      const actual = removeCategory(
        createDatabaseStub(
          {},
          {
            exists: () => false,
            val: () => ({}),
          }
        ).value(),
        createFirestoreStub({}, { docs: { forEach: () => {} } }),
        'test'
      );
      expect(actual).to.be.an.instanceof(Promise);
    });

    it('should resolve an update hash', () =>
      removeCategory(
        createDatabaseStub({}, { exists: () => true, val: () => ({}) }).value(),
        createFirestoreStub({}, { docs: { forEach: () => {} } }),
        'test'
      ).then(actual => expect(actual).to.be.an('object')));
  });

  describe('Removing orphaned records', () => {
    it('should return a promise', () => {
      const actual = removeOrphans(
        createDatabaseStub().value(),
        ['test'],
        stupAdminUtils({}, ['test'])
      );
      expect(actual).to.be.an.instanceof(Promise);
    });

    it('should resolve an update hash', () =>
      removeOrphans(
        createDatabaseStub().value(),
        ['test'],
        stupAdminUtils({}, ['test'])
      ).then(actual => expect(actual).to.be.an('object')));
  });
});

function stupAdminUtils(config = {}, ids = []) {
  return Object.assign(
    {
      fetchRecordIds: () => Promise.resolve(ids),
    },
    config
  );
}
