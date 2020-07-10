const { expect } = require('chai');
const findHistory = require('./find-history');

describe('Deficient Items', function() {
  describe('Find Previous History', function() {
    it('should return "null" when bad historical hash name given', () => {
      const actual = findHistory({})('n/a').previous;
      expect(actual).to.equal(null);
    });

    it('should return "null" when state history is empty', () => {
      const actual = findHistory({ history: {} })('history').previous;
      expect(actual).to.equal(null);
    });

    it('should return "null" when state history has one item', () => {
      const actual = findHistory({ history: { a: { createdAt: 1 } } })(
        'history'
      ).previous;
      expect(actual).to.equal(null);
    });

    it('should return the next most recently created historical item as "previous"', () => {
      const expected = { createdAt: 1 };
      const actual = findHistory({
        history: {
          a: { createdAt: 2 },
          b: expected,
        },
      })('history').previous;
      expect(actual).to.equal(expected);
    });

    it('should return the most recently created historical item as "current"', () => {
      const expected = { createdAt: 2 };
      const actual = findHistory({
        history: {
          a: { createdAt: 1 },
          b: expected,
        },
      })('history').current;
      expect(actual).to.equal(expected);
    });

    it('should sort historical items correctly', () => {
      const expectedCurrent = { createdAt: 122 };
      const expectedPrevious = { createdAt: 121 };
      const history = findHistory({
        history: {
          a: { createdAt: 42 },
          b: { createdAt: 24 },
          c: { createdAt: 102 },
          d: expectedCurrent,
          e: expectedPrevious,
          f: { createdAt: 88 },
          g: { createdAt: 2 },
        },
      })('history');
      const actualPrevious = history.previous;
      const actualCurrent = history.current;
      expect(actualPrevious).to.equal(expectedPrevious, 'found previous');
      expect(actualCurrent).to.equal(expectedCurrent, 'found current');
    });

    it("should return the ID of any of its' historical items", () => {
      const expectedCurrent = 'current';
      const expectedPrevious = 'previous';
      const history = findHistory({
        history: {
          a: { createdAt: 42 },
          b: { createdAt: 24 },
          c: { createdAt: 102 },
          [expectedCurrent]: { createdAt: 122 },
          [expectedPrevious]: { createdAt: 121 },
          f: { createdAt: 88 },
          g: { createdAt: 2 },
        },
      })('history');
      const previous = history.previous;
      const current = history.current;
      const actualPrevious = history.getItemId(previous);
      const actualCurrent = history.getItemId(current);
      expect(actualPrevious).to.equal(expectedPrevious, 'found previous ID');
      expect(actualCurrent).to.equal(expectedCurrent, 'found current ID');
    });
  });
});
