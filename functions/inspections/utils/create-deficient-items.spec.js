const { expect } = require('chai');
const createDeficientItems = require('./create-deficient-items');
const uuid = require('../../test-helpers/uuid');
const { createCompletedMainInputItem: createItem } = require('../../test-helpers/mocking');

describe('Inspections | Utils | Create Deficient Items', () => {
  it('should return an deficent items configuration object', () => {
    const actual = createDeficientItems(createInspection());
    expect(actual).to.be.an('object');
  });

  it('should find all deficient items', () => {
    [
      {
        data: [['twoactions_checkmarkx', true]],
        expected: ['twoactions_checkmarkx'],
        message: 'has one deficient "twoactions_checkmarkx"'
      },
      {
        data: [['twoactions_thumbs', true]],
        expected: ['twoactions_thumbs'],
        message: 'has one deficient "twoactions_thumbs"'
      },
      {
        data: [['threeactions_checkmarkexclamationx', true]],
        expected: ['threeactions_checkmarkexclamationx'],
        message: 'has one deficient "threeactions_checkmarkexclamationx"'
      },
      {
        data: [['threeactions_abc', true]],
        expected: ['threeactions_abc'],
        message: 'has one deficient "threeactions_abc"'
      },
      {
        data: [['fiveactions_onetofive', true]],
        expected: ['fiveactions_onetofive'],
        message: 'has one deficient "fiveactions_onetofive"'
      },
      {
        data: [['oneaction_notes', true]],
        expected: [],
        message: 'has one deficient "oneaction_notes"'
      },
      {
        data: [
          ['twoactions_checkmarkx', true],
          ['twoactions_thumbs', false],
          ['threeactions_checkmarkexclamationx', true],
          ['threeactions_abc', false],
          ['fiveactions_onetofive', true],
          ['oneaction_notes', true],
          ['signature', true],
          ['text_input', true]
        ],
        expected: ['twoactions_checkmarkx', 'threeactions_checkmarkexclamationx', 'fiveactions_onetofive'],
        message: 'has deficient: "twoactions_checkmarkx", "threeactions_checkmarkexclamationx", "fiveactions_onetofive"'
      }
    ].forEach(({ data, expected, message }) => {
      const items = {};
      data.forEach(item => items[uuid()] = createItem(...item));
      const result = createDeficientItems(createInspection({}, items));
      const actual = Object.keys(result).map(itemId => result[itemId].inspectionRefAndItemData.itemData.mainInputType);
      expect(actual).to.deep.equal(expected, message);
    });
  });

  it('should set the default state of deficient items to "requires-action"', () => {
    const itemId = uuid();
    const expected = 'requires-action';
    const actual = createDeficientItems(
      createInspection({},
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId].state;
    expect(actual).to.equal(expected);
  });

  it('should set any available section title', () => {
    const itemId = uuid();
    const sectionId = uuid()
    const expected = 'section-title-test';
    const actual = createDeficientItems(
      createInspection({},
        { [itemId]: createItem('twoactions_checkmarkx', true, { sectionId }) },
        { [sectionId]: { title: expected } }
      )
    )[itemId].inspectionRefAndItemData.sectionTitle;
    expect(actual).to.equal(expected);
  });
});

/**
 * Create an inspection object
 * @param  {Object} inspection
 * @param  {Object} items
 * @return {Object} - inspection
 */
function createInspection(inspection = {}, items = {}, sections = {}) {
  return Object.assign({
    id: uuid(),
    inspectionCompleted: true,
    trackDeficientItems: true,
    updatedLastDate: Date.now() / 1000,
    template: {
      sections: Object.assign({}, sections),
      items: Object.assign({}, items)
    }
  }, inspection);
}
