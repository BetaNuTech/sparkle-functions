const { expect } = require('chai');
const createFindAll = require('./find-all-trello-comment-templates');

describe('Deficient Items', () => {
  describe('Find All Trello Comment Templates', () => {
    it('should always return the default template', () => {
      const defaultTeml = 'default';
      const testUtil = createFindAll({
        transitions: [
          { previous: ['one'], current: ['two'], value: 'transition' },
          { previous: ['two'], current: ['three'], value: 'transition' },
        ],
        states: [{ name: 'three', value: 'state' }],
        default: defaultTeml,
      });

      [
        { result: testUtil('one', 'two'), msg: 'transition match' },
        { result: testUtil('none', 'three'), msg: 'state match' },
        { result: testUtil('two', 'three'), msg: 'state & transition match' },
        { result: testUtil('none', 'none-2'), msg: 'no matches' },
      ].forEach(({ result, msg }) => {
        expect(result).to.be.instanceof(Array);
        const actual = result.includes(defaultTeml);
        expect(actual).to.equal(true, `result contains default for ${msg}`);
      });
    });

    it('should return any matching transition templates first', () => {
      const templates = [
        'transition-a',
        'transition-b',
        'transition-c',
        'transition-d',
        'transition-e',
      ];
      const testUtil = createFindAll({
        transitions: [
          { previous: ['one'], current: ['two'], value: templates[0] },
          { previous: ['two'], current: ['three'], value: templates[1] },
          { previous: ['one', 'two'], current: ['four'], value: templates[2] },
          { previous: ['two'], current: ['four'], value: templates[3] },
          {
            previous: ['five'],
            current: ['six', 'seven'],
            value: templates[4],
          },
        ],
        states: [],
        default: 'default',
      });

      [
        {
          actual: testUtil('one', 'seven'),
          expected: [],
          msg: 'no transition match',
        },
        {
          actual: testUtil('one', 'two'),
          expected: [templates[0]],
          msg: '1st single transition match',
        },
        {
          actual: testUtil('two', 'three'),
          expected: [templates[1]],
          msg: '2nd single transition match',
        },
        {
          actual: testUtil('one', 'four'),
          expected: [templates[2]],
          msg: 'many previous transition match',
        },
        {
          actual: testUtil('five', 'seven'),
          expected: [templates[4]],
          msg: 'many current transition match',
        },
        {
          actual: testUtil('two', 'four'),
          expected: [templates[2], templates[3]],
          msg: 'multiple transition match',
        },
      ].forEach(({ actual, expected, msg }) => {
        actual.pop(); // remove default template
        expect(actual).to.deep.equal(expected, msg);
      });
    });

    it('should return any matching state template after any transition templates', () => {
      const templates = ['transition-a', 'transition-b', 'transition-c'];
      const testUtil = createFindAll({
        transitions: [
          { previous: ['one'], current: ['two'], value: templates[0] },
        ],
        states: [
          { name: 'one', value: templates[1] },
          { name: 'two', value: templates[2] },
        ],
        default: 'default',
      });

      [
        {
          actual: testUtil('none', 'none-2'),
          expected: [],
          msg: 'no state match',
        },
        {
          actual: testUtil('none', 'one'),
          expected: [templates[1]],
          msg: '1st single state match',
        },
        {
          actual: testUtil('none', 'two'),
          expected: [templates[2]],
          msg: '2nd single state match',
        },
        {
          actual: testUtil('one', 'two'),
          expected: [templates[0], templates[2]],
          msg: 'state & transition match',
        },
      ].forEach(({ actual, expected, msg }) => {
        actual.pop(); // remove default template
        expect(actual).to.deep.equal(expected, msg);
      });
    });

    it('should not allow modification to any type of source template', () => {
      const templates = ['transition-a', 'transition-b', 'transition-c'];
      const testUtil = createFindAll({
        transitions: [
          { previous: ['one'], current: ['two'], value: templates[0] },
        ],
        states: [{ name: 'three', value: templates[1] }],
        default: templates[2],
      });

      [
        {
          test: ['one', 'two'],
          expected: `${templates[0]}`,
          msg: 'preserves transition template',
        },
        {
          test: ['none', 'three'],
          expected: `${templates[1]}`,
          msg: 'preserves state template',
        },
        {
          test: ['none', 'none-2'],
          expected: `${templates[2]}`,
          msg: 'preserves default template',
        },
      ].forEach(({ test, expected, msg }) => {
        let [initial] = testUtil(...test);
        initial = `${initial}test`; // modify template
        expect(initial).to.contain('test');
        const [actual] = testUtil(...test); // get fresh template
        expect(actual).to.equal(expected, msg);
      });
    });
  });
});
