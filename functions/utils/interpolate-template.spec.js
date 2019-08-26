const { expect } = require('chai');
const utility = require('./interpolate-template');

describe('Utils | interpolate template', () => {
  it('should interpolate all valid variables, ignoring relevant whitespace', () => {
    [
      { temp: '{{var}}', data: { var: 'a' }, expected: 'a' },
      { temp: '{{ var }}', data: { var: 'a' }, expected: 'a' },
      { temp: '{{v_ar}}', data: { v_ar: 'a' }, expected: 'a' },
      { temp: '{{var1}}', data: { var1: 'a' }, expected: 'a' },
      { temp: '{{var}}', data: { var: 1 }, expected: '1' },
      { temp: '{{var}}a', data: { var: 'a' }, expected: 'aa' },
      { temp: 'a{{var}}a', data: { var: 'a' }, expected: 'aaa' },
    ].forEach(({ temp, data, expected }, i) => {
      const template = utility(temp);
      const actual = template(data);
      expect(actual).to.equal(
        expected,
        `interpolated test ${i + 1}: "${temp}"`
      );
    });
  });

  it('should remove undefined variables from template', () => {
    const expected = '';
    const template = utility('{{test}}');
    const actual = template({});
    expect(actual).to.equal(expected);
  });
});
