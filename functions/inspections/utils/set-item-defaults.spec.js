const { expect } = require('chai');
const mocking = require('../../test-helpers/mocking');
const set = require('./set-item-defaults');

describe('Inspection | Utils | Set Item Defaults', () => {
  it('sets the missing main input type of an item when it is eligible', () => {
    const mainInputItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId: '1' }
    );
    const tests = [
      {
        expected: undefined,
        item: mocking.completedSignatureInputItem(),
        msg: 'ignored signature input',
      },
      {
        expected: undefined,
        item: mocking.incompletedTextInputItem(),
        msg: 'ignored text input item',
      },
      {
        expected: undefined,
        item: { ...mocking.incompletedTextInputItem(), isTextInputItem: false },
        msg: 'ignored text item',
      },
      {
        expected: undefined,
        item: { ...mainInputItem },
        msg: 'ignored main input item with main input type',
      },
      {
        expected: 'TwoActions_thumbs',
        item: { ...mainInputItem, mainInputType: undefined },
        msg: 'set a main input item missing main input type',
      },
    ];
    for (let i = 0; i < tests.length; i++) {
      const { expected, msg, item } = tests[i];
      const result = set(item);
      const actual = result.mainInputType;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('sets an eligible text input selected to false when truthey', () => {
    const tests = [
      {
        expected: undefined,
        item: {
          ...mocking.completedSignatureInputItem(),
          mainInputSelected: true,
        },
        msg: 'ignored signature input',
      },
      {
        expected: undefined,
        item: mocking.createCompletedMainInputItem(),
        msg: 'ignored completed main input item',
      },
      {
        expected: undefined,
        item: { ...mocking.completedTextInputItem(), mainInputSelected: false },
        msg: 'ignored text item with selected false',
      },
      {
        expected: false,
        item: { ...mocking.completedTextInputItem(), mainInputSelected: true },
        msg: 'updated text input item with main input selected',
      },
    ];
    for (let i = 0; i < tests.length; i++) {
      const { expected, msg, item } = tests[i];
      const result = set(item);
      const actual = result.mainInputSelected;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('sets a missing main input selection to a negative number', () => {
    const mainInputItem = mocking.createCompletedMainInputItem();
    const tests = [
      {
        expected: undefined,
        item: mocking.completedSignatureInputItem(),
        msg: 'ignored signature input',
      },
      {
        expected: undefined,
        item: mocking.incompletedTextInputItem(),
        msg: 'ignored text input item',
      },
      {
        expected: undefined,
        item: { ...mocking.incompletedTextInputItem(), isTextInputItem: false },
        msg: 'ignored text item',
      },
      {
        expected: undefined,
        item: { ...mainInputItem, mainInputSelection: 1 },
        msg: 'ignored main input item with selection',
      },
      {
        expected: -1,
        item: { ...mainInputItem, mainInputSelection: undefined },
        msg: 'set a main input item missing any selection',
      },
      {
        expected: -1,
        item: {
          ...mainInputItem,
          mainInputType: undefined,
          mainInputSelection: undefined,
        },
        msg:
          'sets selection of a main input item missing main input type and selection',
      },
    ];
    for (let i = 0; i < tests.length; i++) {
      const { expected, msg, item } = tests[i];
      const result = set(item);
      const actual = result.mainInputSelection;
      expect(actual).to.equal(expected, msg);
    }
  });
});
