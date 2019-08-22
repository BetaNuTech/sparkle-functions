const { expect } = require('chai');
const findPreviousHistory = require('./find-previous-history');

describe('Deficient Items', function() {
  describe('Find Previous History', function() {
    it('should return "null" when bad historical hash name given', () => {
      const actual = findPreviousHistory({})('n/a');
      expect(actual).to.equal(null);
    });

    it('should return "null" when state history is empty', () => {
      const actual = findPreviousHistory({ history: {} })('history');
      expect(actual).to.equal(null);
    });

    it('should return "null" when state history has one item', () => {
      const actual = findPreviousHistory({ history: { a: { createdAt: 1 } } })(
        'history'
      );
      expect(actual).to.equal(null);
    });

    it('should return the next most recently created historical item', () => {
      const expected = { createdAt: 1 };
      const actual = findPreviousHistory({
        history: {
          a: { createdAt: 2 },
          b: expected,
        },
      })('history');
      expect(actual).to.equal(expected);
    });

    it('should sort historical items correctly to find 2nd newest item', () => {
      const expected = { createdAt: 121 };
      const actual = findPreviousHistory({
        history: {
          a: { createdAt: 42 },
          b: { createdAt: 24 },
          c: { createdAt: 102 },
          d: { createdAt: 122 },
          e: expected,
          f: { createdAt: 88 },
          g: { createdAt: 2 },
        },
      })('history');
      expect(actual).to.equal(expected);
    });
  });
});
