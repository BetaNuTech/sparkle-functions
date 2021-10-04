const { expect } = require('chai');
const calc = require('./calculate-score');

describe('Inspections | Utils | Update | Calculate Score', () => {
  it('should score an array of items', function() {
    const msg = 'returns quotient of selected points and total';

    const items = [
      {
        mainInputType: 'twoactions_checkmarkx',
        mainInputSelection: 0,
        mainInputZeroValue: 3,
        mainInputOneValue: 0,
      },
      {
        mainInputType: 'fiveactions_onetofive',
        mainInputSelection: 3,
        mainInputZeroValue: 1,
        mainInputOneValue: 2,
        mainInputTwoValue: 3,
        mainInputThreeValue: 4,
        mainInputFourValue: 5,
      },
      {
        mainInputType: 'threeactions_checkmarkexclamationx',
        mainInputSelection: 0,
        mainInputZeroValue: 5,
        mainInputOneValue: 3,
        mainInputTwoValue: 0,
      },
    ];

    const expected = 92.3076923076923;
    const actual = calc(items);

    expect(actual).to.equal(expected, msg);
  });

  it(' should correctly score an inspection with custom scores', function() {
    const items = [
      {
        mainInputType: 'twoactions_checkmarkx',
        mainInputSelection: 1,
        mainInputZeroValue: 5,
        mainInputOneValue: 3,
      },
      {
        mainInputType: 'fiveactions_onetofive',
        mainInputSelection: 4,
        mainInputZeroValue: 1,
        mainInputOneValue: 2,
        mainInputTwoValue: 3,
        mainInputThreeValue: 4,
        mainInputFourValue: 10,
      },
      {
        mainInputType: 'threeactions_checkmarkexclamationx',
        mainInputSelection: 1,
        mainInputZeroValue: 5,
        mainInputOneValue: 1,
        mainInputTwoValue: 0,
      },
    ];

    const expected = 70; // 14 / 20 (earned / maximum possible)
    const actual = calc(items);

    expect(actual).to.equal(expected);
  });

  it('Does not factor NA items into score', function() {
    const items = [
      {
        mainInputType: 'twoactions_checkmarkx',
        mainInputSelection: 0,
        mainInputZeroValue: 3,
        mainInputOneValue: 0,
      },
      {
        mainInputType: 'fiveactions_onetofive',
        mainInputSelection: 2,
        mainInputZeroValue: 1,
        mainInputOneValue: 2,
        mainInputTwoValue: 3,
        mainInputThreeValue: 4,
        mainInputFourValue: 5,
      },
      {
        isItemNA: true,
        mainInputType: 'threeactions_checkmarkexclamationx',
        mainInputSelection: 0,
        mainInputZeroValue: 5,
        mainInputOneValue: 3,
        mainInputTwoValue: 0,
      },
    ];

    const expected = 75; // 6 / 8 (earned / maximum possible)
    const actual = calc(items);

    expect(actual).to.equal(expected);
  });

  it('Does not factor text, signature, or note action items into score', function() {
    const items = [
      {
        mainInputType: 'twoactions_checkmarkx',
        mainInputSelection: 0,
        mainInputZeroValue: 3,
        mainInputOneValue: 0,
      },
      {
        mainInputType: 'oneaction_notes',
        isTextInputItem: false,
        textInputValue: 'valid note',
      },
      {
        isTextInputItem: true,
        title: 'empty text input',
        textInputValue: '',
      },
      {
        itemType: 'signature',
        isTextInputItem: false,
        mainInputSelection: 1,
        mainInputZeroValue: 3,
        mainInputOneValue: 0,
      },
    ];

    const expected = 100; // 3 / 3 (earned / maximum possible)
    const actual = calc(items);

    expect(actual).to.equal(expected);
  });

  it('Should return a perfect score when inspection has no points', function() {
    const items = [
      {
        isTextInputItem: true,
        title: 'empty text input',
        textInputValue: '',
      },
      {
        itemType: 'signature',
        isTextInputItem: false,
        mainInputSelection: 1,
        mainInputZeroValue: 3,
        mainInputOneValue: 0,
      },
    ];

    const expected = 100;
    const actual = calc(items);

    expect(actual).to.equal(expected);
  });
});
