const { write } = require('./list');
const { expect } = require('chai');
const { createDatabaseStub } = require('../test-helpers/firebase');

describe('Templates List', () => {
  describe('Write template change', () => {
    it('should return a promise', () => {
      const actual = write(createDatabaseStub().value(), 'test', {}, null);
      expect(actual).to.be.an.instanceof(Promise);
    });
  });
});
