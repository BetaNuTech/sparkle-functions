const { expect } = require('chai');
const unflatten = require('./unflatten-string-attrs');

describe('Utils | Unflatten String Attrs', () => {
  it('should clone object without nested strings', () => {
    const expected = {
      one: 1,
      two: 2,
    };

    const actual = unflatten(expected);
    expect(actual).to.not.equal(expected);
    expect(actual).to.deep.equal(expected);
  });

  it('should convert 2 level nested strings to an object', () => {
    const src = {
      one: 1,
      ['obj.two']: 2, // eslint-disable-line
    };
    const expected = {
      one: 1,
      obj: {
        two: 2,
      },
    };

    const actual = unflatten(src);
    expect(actual).to.deep.equal(expected);
  });

  it('should convert many level nested strings to objects', () => {
    const src = {
      one: 1,
      /* eslint-disable */
      ['obj.obj2.obj3']: {
        two: 2,
      },
      /* eslint-enable */
    };
    const expected = {
      one: 1,
      obj: {
        obj2: {
          obj3: {
            two: 2,
          },
        },
      },
    };

    const actual = unflatten(src);
    expect(actual).to.deep.equal(expected);
  });
});
