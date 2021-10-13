const { expect } = require('chai');
const util = require('./strings');

describe('Utils | Strings', () => {
  it('capitalizes a mixed capitalized sentence', () => {
    const expected = 'The Quick Brown Fox';
    const actual = util.toCapitalize('tHe QuicK bRoWN FOX');
    expect(actual).to.equal(expected);
  });

  it('humanizes a camel cased string to a human friendly sentence', () => {
    const expected = 'Hello Human';
    const actual = util.toHumanize('helloHuman');
    expect(actual).to.equal(expected);
  });
});
