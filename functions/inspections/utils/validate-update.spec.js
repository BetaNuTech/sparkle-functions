const { expect } = require('chai');
const validate = require('./validate-update');

const update = {
  template: {
    items: {
      key: {},
    },
  },
};

describe('Inspection | Utils | Validate inspection Update', () => {
  it('rejects invalid inspection update attribute', () => {
    const expected = 'template';
    const result = validate({
      template: 'true',
    });
    const actual = result.map(err => err.path).join(',');
    expect(actual).to.deep.equal(expected);
  });

  it('accpets a valid job update', () => {
    const expected = [];
    const actual = validate({
      ...update,
    });

    expect(actual).to.deep.equal(expected);
  });
});
