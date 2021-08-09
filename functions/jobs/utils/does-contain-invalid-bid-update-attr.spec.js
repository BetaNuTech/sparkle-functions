const { expect } = require('chai');
const containInvalidAttr = require('../utils/does-contain-invalid-bid-update-attr');

describe('Jobs | Utils | Does Bid Update Contain Invalid Attr', () => {
  it('rejects invalid bid update attribute', () => {
    const expected = true;

    const actual = containInvalidAttr({ invalid: 'invalid attr' });
    expect(actual).to.equal(expected);
  });

  it('accpets a valid bid update', () => {
    const expected = false;

    const actual = containInvalidAttr({ state: 'approved' });
    expect(actual).to.equal(expected);
  });
});