const { expect } = require('chai');
const validate = require('./validate-bid');
const config = require('../../config');

const requiredAttrs = {
  vendor: 'test',
  scope: config.bids.scopeTypes[0],
};

describe('Jobs | Utils | Validate Bid Create', () => {
  it('rejects if required attribute is not provided in schema', () => {
    const expected = ['scope', 'vendor'];
    const result = validate({
      vendorDetails: 'test',
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects invalid bid', () => {
    const data = [
      {
        bid: { ...requiredAttrs, vendor: 1 },
        expected: 'vendor',
        msg: 'rejects non-string for vendor',
      },
      {
        bid: { ...requiredAttrs, vendorDetails: 1 },
        expected: 'vendorDetails',
        msg: 'rejects non-string for vendor details',
      },
      {
        bid: { ...requiredAttrs, costMin: 'test' },
        expected: 'costMin',
        msg: 'rejects non-number for cost min',
      },
      {
        bid: { ...requiredAttrs, costMax: 'test' },
        expected: 'costMax',
        msg: 'rejects non-number for cost max',
      },
      {
        bid: { ...requiredAttrs, startAt: 'test' },
        expected: 'startAt',
        msg: 'rejects non-number for start at',
      },
      {
        bid: { ...requiredAttrs, completeAt: 'test' },
        expected: 'completeAt',
        msg: 'rejects non-number for complete at',
      },
      {
        bid: { ...requiredAttrs, scope: 'fake' },
        expected: 'scope',
        msg: 'rejects non-enum scope value',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { bid, expected, msg } = data[i];
      const result = validate({ vendor: 'test', ...bid });
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects if started at is greater than completed at', () => {
    const expected = ['completeAt', 'startAt'];
    const result = validate({
      ...requiredAttrs,
      completeAt: 1,
      startAt: 2,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects if cost min is greater than cost max', () => {
    const expected = ['costMax', 'costMin'];
    const result = validate({
      ...requiredAttrs,
      costMin: 2,
      costMax: 1,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts a fixed cost bid', () => {
    const expected = [];
    const result = validate({
      ...requiredAttrs,
      costMin: 1,
      costMax: 1,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects if completed at is greater than started at', () => {
    const expected = ['completeAt', 'startAt'];
    const result = validate({
      ...requiredAttrs,
      completeAt: 1,
      startAt: 2,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts a valid min cost, even when max cost is unset', () => {
    const expected = [];
    const result = validate({
      ...requiredAttrs,
      costMin: 1,
      costMax: undefined,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts a valid max cost, even when min cost is unset', () => {
    const expected = [];
    const result = validate({
      ...requiredAttrs,
      costMax: 1,
      costMin: undefined,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects if completed at is less than started at', () => {
    const expected = ['completeAt', 'startAt'];
    const result = validate({
      ...requiredAttrs,
      completeAt: 1,
      startAt: 2,
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts unsetting both completed at and start at times', () => {
    const expected = [];
    const tests = [
      {
        data: {
          ...requiredAttrs,
          completeAt: 0,
          startAt: 1,
        },
        msg: 'unset completed at with valid start at',
      },
      {
        data: {
          ...requiredAttrs,
          completeAt: 1,
          startAt: 0,
        },
        msg: 'unset started at with valid completed at',
      },
      {
        data: {
          ...requiredAttrs,
          completeAt: 0,
          startAt: 0,
        },
        msg: 'unset started at and completed at together',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, msg } = tests[i];
      const actual = getResults(validate(data));
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('accepts unsetting both min and max costs', () => {
    const expected = [];
    const tests = [
      {
        data: {
          ...requiredAttrs,
          costMax: 0,
          costMin: 1,
        },
        msg: 'unset max cost with valid min cost',
      },
      {
        data: {
          ...requiredAttrs,
          costMax: 1,
          costMin: 0,
        },
        msg: 'unset min cost with valid max cost',
      },
      {
        data: {
          ...requiredAttrs,
          costMax: 0,
          costMin: 0,
        },
        msg: 'unset min cost and max cost together',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, msg } = tests[i];
      const actual = getResults(validate(data));
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects with all errors for completed at, started at, cost min, and cost max', () => {
    const expected = ['completeAt', 'costMax', 'costMin', 'startAt'];
    const result = validate({
      ...requiredAttrs,
      costMin: 2,
      costMax: 1,
      startAt: 2,
      completeAt: 1,
    });

    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accpets a valid bid', () => {
    const expected = [];
    const result = validate({
      vendor: 'test',
      vendorDetails: 'test',
      costMin: 1,
      costMax: 2,
      startAt: 1,
      completeAt: 2,
      scope: config.bids.scopeTypes[0],
    });

    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });
});

/**
 * Flatted validate results to path pointers
 * @param  {Object[]}} validateResult
 * @return {String[]}
 */
function getResults(validateResult) {
  return validateResult.map(r => r.path).sort();
}
