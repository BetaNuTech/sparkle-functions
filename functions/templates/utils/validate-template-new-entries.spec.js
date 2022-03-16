const { expect } = require('chai');
const validate = require('./validate-template-new-entries');
const mocking = require('../../test-helpers/mocking');

const DEFAULT_SCORES = Object.freeze({
  mainInputZeroValue: 0,
  mainInputOneValue: 1,
  mainInputTwoValue: 2,
  mainInputThreeValue: 3,
  mainInputFourValue: 4,
});

describe('Templates | Utils | Validate Template New Entries', () => {
  it('rejects invalid section creations', () => {
    const tests = [
      {
        data: { sections: { one: { index: 0, section_type: 'single' } } },
        expected: 'sections.one.title',
        msg: 'rejects untitled section',
      },
      {
        data: { sections: { one: { title: 'test', section_type: 'single' } } },
        expected: 'sections.one.index',
        msg: 'rejects unindexed section',
      },
      {
        data: { sections: { one: { title: 'test', index: 0 } } },
        expected: 'sections.one.section_type',
        msg: 'rejects untyped section',
      },
      {
        data: {
          sections: { one: { title: 'test', index: 0, section_type: 'none' } },
        },
        expected: 'sections.one.section_type',
        msg: 'rejects unvalid section type',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const template = mocking.createTemplate();
      const result = validate(template, data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('ignores section updates', () => {
    const expected = [];
    const template = mocking.createTemplate({
      sections: {
        one: mocking.createSection(),
      },
    });
    const result = validate(template, {
      sections: {
        one: { title: 'updated' },
      },
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects invalid item type creation', () => {
    const expected = ['items.one.itemType'];
    const template = mocking.createTemplate();
    const result = validate(template, {
      items: {
        one: {
          title: 't',
          index: 0,
          itemType: 'fake',
          sectionId: '1',
          ...DEFAULT_SCORES,
        },
      },
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('rejects unscored item creation', () => {
    const missingZeroScores = { ...DEFAULT_SCORES };
    const missingOneScores = { ...DEFAULT_SCORES };
    const missingTwoScores = { ...DEFAULT_SCORES };
    const missingThreeScores = { ...DEFAULT_SCORES };
    const missingFourScores = { ...DEFAULT_SCORES };
    delete missingZeroScores.mainInputZeroValue;
    delete missingOneScores.mainInputOneValue;
    delete missingTwoScores.mainInputTwoValue;
    delete missingThreeScores.mainInputThreeValue;
    delete missingFourScores.mainInputFourValue;

    const tests = [
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              photos: true,
              notes: true,
              ...missingZeroScores,
            },
          },
        },
        expected: 'items.one.mainInputZeroValue',
        msg: 'rejects invalid zero value',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'text_input',
              sectionId: '1',
              ...missingOneScores,
            },
          },
        },
        expected: 'items.one.mainInputOneValue',
        msg: 'rejects invalid one value',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'signature',
              sectionId: '1',
              ...missingTwoScores,
            },
          },
        },
        expected: 'items.one.mainInputTwoValue',
        msg: 'rejects invalid two value',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              photos: true,
              notes: true,
              ...missingThreeScores,
            },
          },
        },
        expected: 'items.one.mainInputThreeValue',
        msg: 'rejects invalid three value',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'text_input',
              sectionId: '1',
              ...missingFourScores,
            },
          },
        },
        expected: 'items.one.mainInputFourValue',
        msg: 'rejects invalid four value',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const template = mocking.createTemplate();
      const result = validate(template, data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects invalid text input item creation', () => {
    const tests = [
      {
        data: {
          items: {
            one: {
              index: 0,
              itemType: 'text_input',
              sectionId: '1',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.title',
        msg: 'rejects untitled item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              itemType: 'text_input',
              sectionId: '1',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.index',
        msg: 'rejects unindexed item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'text_input',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.sectionId',
        msg: 'rejects unsectioned item',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const template = mocking.createTemplate();
      const result = validate(template, data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects invalid signature item creation', () => {
    const tests = [
      {
        data: {
          items: {
            one: {
              index: 0,
              itemType: 'signature',
              sectionId: '1',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.title',
        msg: 'rejects untitled item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              itemType: 'signature',
              sectionId: '1',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.index',
        msg: 'rejects unindexed item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'signature',
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.sectionId',
        msg: 'rejects unsectioned item',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const template = mocking.createTemplate();
      const result = validate(template, data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('rejects invalid main item creation', () => {
    const tests = [
      {
        data: {
          items: {
            one: {
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              photos: true,
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.title',
        msg: 'rejects untitled item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              photos: true,
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.index',
        msg: 'rejects unindexed item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              photos: true,
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.sectionId',
        msg: 'rejects unsectioned item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              sectionId: '1',
              photos: true,
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.mainInputType',
        msg: 'rejects missing main input type item',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'fake',
              sectionId: '1',
              photos: true,
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.mainInputType',
        msg: 'rejects invalid main item type',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              photos: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.notes',
        msg: 'rejects missing notes',
      },
      {
        data: {
          items: {
            one: {
              title: 't',
              index: 0,
              itemType: 'main',
              mainInputType: 'twoactions_checkmarkx',
              sectionId: '1',
              notes: true,
              ...DEFAULT_SCORES,
            },
          },
        },
        expected: 'items.one.photos',
        msg: 'rejects missing photos',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { data, expected, msg } = tests[i];
      const template = mocking.createTemplate();
      const result = validate(template, data);
      const actual = getResults(result).join(',');
      expect(actual).to.deep.equal(expected, msg);
    }
  });

  it('accepts all valid section and item update', () => {
    const expected = [];
    const template = mocking.createTemplate();
    const result = validate(template, {
      sections: {
        sectionOne: {
          title: 't',
          index: 0,
          section_type: 'single',
        },
      },
      items: {
        one: {
          title: 't',
          index: 0,
          itemType: 'main',
          sectionId: 'sectionOne',
          mainInputType: 'twoactions_checkmarkx',
          photos: true,
          notes: true,
          ...DEFAULT_SCORES,
        },
        two: {
          title: 't',
          index: 1,
          itemType: 'text_input',
          sectionId: 'sectionOne',
          ...DEFAULT_SCORES,
        },
        three: {
          title: 't',
          index: 2,
          itemType: 'signature',
          sectionId: 'sectionOne',
          ...DEFAULT_SCORES,
        },
      },
    });
    const actual = getResults(result);
    expect(actual).to.deep.equal(expected);
  });

  it('ignores updates to existing item', () => {
    const expected = [];
    const template = mocking.createTemplate({
      sections: {
        sectionOne: mocking.createSection(),
      },
      items: {
        one: mocking.completedTextInputItem({ sectionId: 'sectionOne' }),
      },
    });
    const result = validate(template, {
      items: {
        one: { title: 'updated' },
      },
    });
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
