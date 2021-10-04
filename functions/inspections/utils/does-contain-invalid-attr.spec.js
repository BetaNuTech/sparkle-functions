const { expect } = require('chai');
const containInvalidAttr = require('./does-contain-invalid-attr');

describe('Inspection | Utils | Does Contain Invalid Attr', () => {
  it('rejects invalid inspection update attribute', () => {
    const expected = true;

    const actual = containInvalidAttr({ templateName: 'invalid attr' });
    expect(actual).to.equal(expected);
  });

  it('accpets a valid inspection update', () => {
    const expected = false;

    const actual = containInvalidAttr({ items: {} });
    expect(actual).to.equal(expected);
  });
});
