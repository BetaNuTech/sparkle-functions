const { expect } = require('chai');
const validate = require('./validate-bid');

describe('Jobs | Utils | Validate Bid Create', () => {
  it('rejects if required attribute is not provided in schema', () => {
    const expected = 'vendor is required';
    const result = validate({
      vendorDetails: 'test',
    });
    const actual = `${result[0].path} is required`;
    expect(actual).to.equal(expected);
  });

  it('rejects if non existing bid attribute is provided', () => {
    const expected = [];
    const actual = validate({
      vendor: 'test',
      invalid: 'non-exixting',
    });

    expect(actual).to.deep.equal(expected);
  });

  it('rejects invalid bid', () => {
    const data = [
      {
        bid: { vendor: 1 },
        expected: 'vendor',
        msg: 'rejects non-string for vendor',
      },
      {
        bid: { vendorDetails: 1 },
        expected: 'vendorDetails',
        msg: 'rejects non-string for vendorDetails',
      },
      {
        bid: { costMin: 'test' },
        expected: 'costMin',
        msg: 'rejects non-number for costMin',
      },
      {
        bid: { costMax: 'test' },
        expected: 'costMax',
        msg: 'rejects non-number for costMax',
      },
      {
        bid: { startedAt: 'test' },
        expected: 'startedAt',
        msg: 'rejects non-number for startedAt',
      },
      {
        bid: { completedAt: 'test' },
        expected: 'completedAt',
        msg: 'rejects non-number for completedAt',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { bid, expected, msg } = data[i];
      const result = validate({ vendor: 'test', ...bid });
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects if cost max is greater than cost min', async () => {
    const expected = [
      'Validation failed for costMin.',
      'Validation failed for costMax.',
    ];

    const result = validate({
      vendor: 'test',
      costMin: 1,
      costMax: 1,
    });

    const actual = [];

    result.map(({ message }) => actual.push(message)).join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('rejects if started at is greater than completed at', async () => {
    const expected = [
      'Validation failed for startedAt.',
      'Validation failed for completedAt.',
    ];

    const result = validate({
      vendor: 'test',
      completedAt: 1,
      startedAt: 2,
    });

    const actual = [];

    result.map(({ message }) => actual.push(message)).join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('accepts if cost min is greater than cost max', async () => {
    const expected = [];

    const result = validate({
      vendor: 'test',
      costMin: 2,
      costMax: 1,
    });

    const actual = [];

    result.map(({ message }) => actual.push(message)).join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('accepts if completed at is greater than started at', async () => {
    const expected = [];

    const result = validate({
      vendor: 'test',
      completedAt: 2,
      startedAt: 1,
    });

    const actual = [];

    result.map(({ message }) => actual.push(message)).join(',');

    expect(actual).to.deep.equal(expected);
  });

  it('accpets a valid bid', () => {
    const expected = [];
    const actual = validate({
      vendor: 'test',
      vendorDetails: 'test',
      costMin: 2,
      costMax: 1,
      startedAt: 1,
      completedAt: 2,
    });

    expect(actual).to.deep.equal(expected);
  });
});
