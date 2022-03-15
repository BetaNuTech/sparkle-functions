const { expect } = require('chai');
const containInvalidAttr = require('../utils/does-contain-invalid-attr');

describe('Templates | Utils | Does Contain Invalid Attr', () => {
  it('rejects invalid job update attribute', () => {
    const expected = true;

    const actual = containInvalidAttr({ invalid: 'invalid attr' });
    expect(actual).to.equal(expected);
  });

  it('accpets a valid job update', () => {
    const expected = false;

    const actual = containInvalidAttr({ name: 'alright' });
    expect(actual).to.equal(expected);
  });
});
