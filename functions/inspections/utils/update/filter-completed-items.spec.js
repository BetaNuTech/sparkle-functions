const { expect } = require('chai');
const mocking = require('../../../test-helpers/mocking');
const filterCompleted = require('./filter-completed-items');

describe('Unit | Inspections | Utils | Update | Filter Completed Item', () => {
  it('it filters all completed inspection items', () => {
    const expected = 2;

    // Test backwards compatiblity of itemType
    const backwardsCompatible = mocking.createCompletedMainInputItem();
    backwardsCompatible.itemType = undefined;

    const result = filterCompleted([
      mocking.createCompletedMainInputItem(),
      backwardsCompatible,
      mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
        sectionId: '1',
      }),
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all non-applicable inspection items', () => {
    const expected = 1;
    const result = filterCompleted([{ isItemNA: true }, { isItemNA: false }]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all completed text input items', () => {
    const expected = 2;
    const result = filterCompleted([
      mocking.completedTextInputItem(),
      mocking.completedTextInputItem({ itemType: undefined }), // test backwards compatiblity
      mocking.incompletedTextInputItem(),
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all completed main note input items', () => {
    const expected = 2;
    const result = filterCompleted([
      mocking.completedMainNoteInputItem(),
      mocking.completedMainNoteInputItem({ itemType: undefined }), // test backwards compatiblity
      mocking.incompletedMainNoteInputItem(),
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all completed signature input items', () => {
    const expected = 2;
    const result = filterCompleted([
      mocking.completedSignatureInputItem(),
      mocking.incompletedSignatureInputItem(),
      mocking.completedSignatureInputItem(),
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it does not filter duplicate items', () => {
    const expected = 1;
    const completedItem = mocking.createCompletedMainInputItem();
    const result = filterCompleted([completedItem, completedItem]);
    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all empty, "if yes" items, that come after deficient items', () => {
    const expected = 2;
    const result = filterCompleted([
      {
        sectionId: '1',
        index: 1,
        mainInputSelected: true,
        mainInputSelection: 1,
        mainInputType: 'twoactions_thumbs',
      }, // deficient previous
      {
        sectionId: '1',
        index: 2,
        title: 'If yes, return',
        isTextInputItem: true,
        textInputValue: '',
      }, // empty "if yes" item
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });

  it('it filters all empty, "if no" items, that come after sufficent items', () => {
    const expected = 2;
    const result = filterCompleted([
      {
        sectionId: '1',
        index: 1,
        mainInputSelected: true,
        mainInputSelection: 0,
        mainInputType: 'twoactions_thumbs',
      }, // deficient previous
      {
        sectionId: '1',
        index: 2,
        title: 'If no, return',
        isTextInputItem: true,
        textInputValue: '',
      }, // empty "if no" item
    ]);

    const actual = result.length;
    expect(actual).to.equal(expected);
  });
});
