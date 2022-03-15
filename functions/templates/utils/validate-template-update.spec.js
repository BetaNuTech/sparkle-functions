const { expect } = require('chai');
const validate = require('./validate-template-update');

describe('Templates | Utils | Validate Template Update', () => {
  it('rejects invalid update', () => {
    const tests = [
      {
        data: { name: 1 },
        expected: 'name',
        msg: 'rejects non-string name',
      },
      {
        data: { description: 1 },
        expected: 'description',
        msg: 'rejects non-string description',
      },
      {
        data: { category: true },
        expected: 'category',
        msg: 'rejects non-string category',
      },
      {
        data: { trackDeficientItems: 'test' },
        expected: 'trackDeficientItems',
        msg: 'rejects non-boolean track deficient items',
      },
      {
        data: { requireDeficientItemNoteAndPhoto: 4 },
        expected: 'requireDeficientItemNoteAndPhoto',
        msg: 'rejects non-boolean require deficient item note and photo',
      },
      {
        data: { sections: { one: { index: true } } },
        expected: 'sections.one.index',
        msg: 'rejects non-number section index',
      },
      {
        data: { sections: { one: { section_type: 1 } } },
        expected: 'sections.one.section_type',
        msg: 'rejects non-string section type',
      },
      {
        data: { sections: { one: { title: 1 } } },
        expected: 'sections.one.title',
        msg: 'rejects non-string section title',
      },
      {
        data: { items: { one: { index: true } } },
        expected: 'items.one.index',
        msg: 'rejects non-number item index',
      },
      {
        data: { items: { one: { itemType: true } } },
        expected: 'items.one.itemType',
        msg: 'rejects non-string item type',
      },
      {
        data: { items: { one: { title: 1 } } },
        expected: 'items.one.title',
        msg: 'rejects non-string item title',
      },
      {
        data: { items: { one: { mainInputType: 1 } } },
        expected: 'items.one.mainInputType',
        msg: 'rejects non-string item main input type',
      },
      {
        data: { items: { one: { mainInputZeroValue: '1' } } },
        expected: 'items.one.mainInputZeroValue',
        msg: 'rejects non-number item main input zero value',
      },
      {
        data: { items: { one: { mainInputOneValue: '1' } } },
        expected: 'items.one.mainInputOneValue',
        msg: 'rejects non-number item main input one value',
      },
      {
        data: { items: { one: { mainInputTwoValue: '1' } } },
        expected: 'items.one.mainInputTwoValue',
        msg: 'rejects non-number item main input two value',
      },
      {
        data: { items: { one: { mainInputThreeValue: '1' } } },
        expected: 'items.one.mainInputThreeValue',
        msg: 'rejects non-number item main input three value',
      },
      {
        data: { items: { one: { mainInputFourValue: '1' } } },
        expected: 'items.one.mainInputFourValue',
        msg: 'rejects non-number item main input four value',
      },
      {
        data: { items: { one: { notes: 1 } } },
        expected: 'items.one.notes',
        msg: 'rejects non-boolean item notes',
      },
      {
        data: { items: { one: { photos: 1 } } },
        expected: 'items.one.photos',
        msg: 'rejects non-boolean item photos',
      },
      {
        data: { items: { one: { sectionId: 1 } } },
        expected: 'items.one.sectionId',
        msg: 'rejects non-string section ID',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const result = validate(data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects updating a template with an invalid name', () => {
    const expected = ['name'];
    const result = validate({ name: '' });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects updating a section with an invalid title', () => {
    const expected = ['sections.one.title'];
    const result = validate({ sections: { one: { title: '' } } });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects updating an item with an invalid title', () => {
    const expected = ['items.one.title'];
    const result = validate({ items: { one: { title: '' } } });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accpets a valid template update', () => {
    const expected = [];
    const result = validate({
      name: 'test',
      description: 'test',
      category: '123',
      trackDeficientItems: true,
      requireDeficientItemNoteAndPhoto: true,
      sections: {
        one: {
          index: 0,
          section_type: 'single',
          title: 'test',
        },
      },
      items: {
        two: {
          index: 0,
          itemType: 'main',
          title: 'Four',
          sectionId: 'one',
          mainInputType: 'twoactions_checkmarkx',
          mainInputFourValue: 0,
          mainInputOneValue: 0,
          mainInputThreeValue: 0,
          mainInputTwoValue: 0,
          mainInputZeroValue: 3,
          notes: true,
          photos: true,
        },
      },
    });

    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts a section delete', () => {
    const expected = [];
    const result = validate({ sections: { one: null } });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('accepts an item delete', () => {
    const expected = [];
    const result = validate({ items: { one: null } });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });
});

/**
 * Flatted validate results to path pointers
 * @param  {Object[]}} validateResult
 * @return {String[]}
 */
function getResults(validateResult) {
  return validateResult.map(r => r.path).sort();
}
