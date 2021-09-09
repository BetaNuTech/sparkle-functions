const { expect } = require('chai');
const validate = require('./validate-bid');
const config = require('../../config');

const requiredAttrs = {
  vendor: 'test',
  scope: config.bids.scopeTypes[0],
};

describe('Jobs | Utils | Validate Bid Create', () => {
  it('rejects if required attribute is not provided in schema', () => {
    const expected = 'vendor,scope is required';
    const result = validate({
      vendorDetails: 'test',
    });
    const paths = result.map(r => r.path).join(',');
    const actual = `${paths} is required`;
    expect(actual).to.equal(expected);
  });

  it('rejects if non existing bid attribute is provided', () => {
    const expected = [];
    const actual = validate({
      ...requiredAttrs,
      invalid: 'non-exixting',
    });

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
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects if started at is greater than completed at', () => {
    const expected = [
      'Validation failed for startAt.',
      'Validation failed for completeAt.',
    ];
    const result = validate({
      ...requiredAttrs,
      completeAt: 1,
      startAt: 2,
    });
    const actual = [];

    result.map(({ message }) => actual.push(message)).join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('rejects if cost min is greater than cost max', () => {
    const expected = 'costMax,costMin';
    const result = validate({
      ...requiredAttrs,
      costMin: 2,
      costMax: 1,
    });
    const actual = result
      .map(({ path }) => path)
      .sort()
      .join(',');
    expect(actual).to.deep.equal(expected);
  });

  it('accepts a fixed cost bid', () => {
    const expected = '';
    const result = validate({
      ...requiredAttrs,
      costMin: 1,
      costMax: 1,
    });
    const actual = result
      .map(({ path }) => path)
      .sort()
      .join(',');
    expect(actual).to.deep.equal(expected);
  });

  it('rejects if completed at is greater than started at', () => {
    const expected = 'completeAt,startAt';
    const result = validate({
      ...requiredAttrs,
      completeAt: 1,
      startAt: 2,
    });
    const actual = result
      .map(({ path }) => path)
      .sort()
      .join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('accpets a valid bid', () => {
    const expected = [];
    const actual = validate({
      vendor: 'test',
      vendorDetails: 'test',
      costMin: 1,
      costMax: 2,
      startAt: 1,
      completeAt: 2,
      scope: config.bids.scopeTypes[0],
    });

    expect(actual).to.deep.equal(expected);
  });
});
