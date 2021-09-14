const { expect } = require('chai');
const config = require('../../config');
const containInvalidAttr = require('../utils/does-contain-invalid-bid-update-attr');

describe('Jobs | Utils | Does Bid Update Contain Invalid Attr', () => {
  it('rejects invalid bid update attribute', () => {
    const expected = true;

    const actual = containInvalidAttr({ invalid: 'invalid attr' });
    expect(actual).to.equal(expected);
  });

  it('accpets a valid bid update', () => {
    const expected = false;

    const actual = containInvalidAttr({
      state: 'approved',
      scope: config.bids.scopeTypes[0],
      completeAt: 123,
      startAt: 1,
    });
    expect(actual).to.equal(expected);
  });
});
