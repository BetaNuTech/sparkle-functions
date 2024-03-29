const { expect } = require('chai');
const createDeficientItems = require('./create-deficient-items');
const uuid = require('../../test-helpers/uuid');
const {
  createCompletedMainInputItem: createItem,
  createItem: createTextInputItem,
} = require('../../test-helpers/mocking');

/**
 * Create an inspection object
 * @param  {Object} inspection
 * @param  {Object} items
 * @return {Object} - inspection
 */
function createInspection(inspection = {}, items = {}, sections = {}) {
  return Object.assign(
    {
      id: uuid(),
      inspectionCompleted: true,
      updatedLastDate: Date.now() / 1000,
      template: {
        trackDeficientItems: true,
        sections: Object.assign({}, sections),
        items: Object.assign({}, items),
      },
    },
    inspection
  );
}

describe('Deficient Items | Utils | Create Deficient Items', () => {
  it('should return an deficent items configuration object', () => {
    const actual = createDeficientItems(createInspection());
    expect(actual).to.be.an('object');
  });

  it('should find all deficient items', () => {
    [
      {
        data: [['twoactions_checkmarkx', true]],
        expected: ['twoactions_checkmarkx'],
        message: 'has one deficient "twoactions_checkmarkx"',
      },
      {
        data: [['twoactions_thumbs', true]],
        expected: ['twoactions_thumbs'],
        message: 'has one deficient "twoactions_thumbs"',
      },
      {
        data: [['threeactions_checkmarkexclamationx', true]],
        expected: ['threeactions_checkmarkexclamationx'],
        message: 'has one deficient "threeactions_checkmarkexclamationx"',
      },
      {
        data: [['threeactions_abc', true]],
        expected: ['threeactions_abc'],
        message: 'has one deficient "threeactions_abc"',
      },
      {
        data: [['fiveactions_onetofive', true]],
        expected: ['fiveactions_onetofive'],
        message: 'has one deficient "fiveactions_onetofive"',
      },
      {
        data: [['oneaction_notes', true]],
        expected: [],
        message: 'does not have deficient note item',
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
          ['text_input', true],
        ],
        expected: [
          'twoactions_checkmarkx',
          'threeactions_checkmarkexclamationx',
          'fiveactions_onetofive',
        ],
        message:
          'has deficient: "twoactions_checkmarkx", "threeactions_checkmarkexclamationx", "fiveactions_onetofive"',
      },
    ].forEach(({ data, expected, message }) => {
      const items = {};
      data.forEach(function(item) {
        items[uuid()] = createItem(...item);
      });
      const result = createDeficientItems(createInspection({}, items));
      const actual = Object.keys(result).map(
        itemId => result[itemId].itemMainInputType
      );
      expect(actual).to.deep.equal(expected, message);
    });
  });

  it("should set the inspection's reference ID", () => {
    const expected = uuid();
    const itemId = uuid();
    const actual = createDeficientItems(
      createInspection(
        { id: expected },
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId].inspection;
    expect(actual).to.equal(expected);
  });

  it("should set the item's reference ID", () => {
    const expected = uuid();
    const actual = createDeficientItems(
      createInspection(
        {},
        { [expected]: createItem('twoactions_checkmarkx', true) }
      )
    )[expected].item;
    expect(actual).to.equal(expected);
  });

  it('should set an initial "createdAt" timestamp', () => {
    const itemId = uuid();
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId].createdAt;
    expect(actual).to.be.ok;
    expect(actual).to.be.a('number');
  });

  it('should set an initial "updatedAt" timestamp', () => {
    const itemId = uuid();
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId].updatedAt;
    expect(actual).to.be.ok;
    expect(actual).to.be.a('number');
  });

  it('should set the default state of deficient items to "requires-action"', () => {
    const itemId = uuid();
    const expected = 'requires-action';
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId].state;
    expect(actual).to.equal(expected);
  });

  it('should set any available section title', () => {
    const itemId = uuid();
    const sectionId = uuid();
    const expected = 'section-title-test';
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true, { sectionId }) },
        { [sectionId]: { title: expected } }
      )
    )[itemId].sectionTitle;
    expect(actual).to.equal(expected);
  });

  it('should set any available section type', () => {
    const itemId = uuid();
    const sectionId = uuid();
    const expected = 'multi';
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true, { sectionId }) },
        { [sectionId]: { title: '', section_type: expected } }
      )
    )[itemId].sectionType;
    expect(actual).to.equal(expected);
  });

  it('should set any available item title', () => {
    const itemId = uuid();
    const expected = 'title';
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('twoactions_checkmarkx', true, {
            title: expected,
          }),
        }
      )
    )[itemId].itemTitle;
    expect(actual).to.equal(expected);
  });

  it('should set any available item inspector notes', () => {
    const itemId = uuid();
    const expected = 'notes';
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('twoactions_checkmarkx', true, {
            inspectorNotes: expected,
          }),
        }
      )
    )[itemId].itemInspectorNotes;
    expect(actual).to.equal(expected);
  });

  it('should set any available item main input type', () => {
    const itemId = uuid();
    const expected = 'twoactions_checkmarkx';
    const actual = createDeficientItems(
      createInspection({}, { [itemId]: createItem(expected, true) })
    )[itemId].itemMainInputType;
    expect(actual).to.equal(expected);
  });

  it('should set any available, falsey, item input selection', () => {
    const itemId = uuid();
    const expected = 0;
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('fiveactions_onetofive', true, {
            mainInputSelection: expected,
          }),
        }
      )
    )[itemId];
    expect(actual.itemMainInputSelection).to.equal(expected);
  });

  it('should deeply clone any available item admin edits', () => {
    const itemId = uuid();
    const expected = {
      [uuid()]: {
        action: 'selected B',
        admin_name: 'test',
        admin_uid: uuid(),
        edit_date: 1554227737,
      },
    };
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('twoactions_checkmarkx', true, {
            adminEdits: expected,
          }),
        }
      )
    )[itemId].itemAdminEdits;
    expect(actual).to.not.equal(expected, 'cloned new object');
    expect(actual).to.deep.equal(expected, 'cloned admin edits matches');
  });

  it('should not clone item with only invalid photo data', () => {
    const itemId = uuid();
    const expected = {
      1554325519707: {
        caption: 'Invalid: missing download URL',
        downloadURL: '',
      },
    };
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('twoactions_checkmarkx', true, {
            photosData: expected,
          }),
        }
      )
    )[itemId];
    expect(actual.hasItemPhotoData).to.equal(false, 'has no item photos data');
    expect(actual.itemPhotosData).to.equal(
      undefined,
      'undefined item photos data hash'
    );
  });

  it('should deeply clone only valid item photos data', () => {
    const itemId = uuid();
    const expected = {
      1554325519707: { caption: 'a caption!', downloadURL: 'google.com' },
    };
    const actual = createDeficientItems(
      createInspection(
        {},
        {
          [itemId]: createItem('twoactions_checkmarkx', true, {
            photosData: {
              ...expected,
              1554325519708: { caption: 'invalid', downloadURL: '' }, // should be removed
            },
          }),
        }
      )
    )[itemId];
    expect(actual.hasItemPhotoData).to.equal(true, 'has item photos data');
    expect(actual.itemPhotosData).to.not.equal(expected, 'cloned new object');
    expect(actual.itemPhotosData).to.deep.equal(
      expected,
      'cloned photos data matches'
    );
  });

  it("should set a subtitle from a multi-sections' first text input title", () => {
    const itemId = uuid();
    const sectionId = uuid();

    [
      {
        data: createInspection(
          {},
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              index: 1,
            }),
          },
          { [sectionId]: { section_type: 'multi' } }
        ),
        expected: undefined,
        message: 'non-existent text input item yields no sub title',
      },
      {
        data: createInspection(
          {},
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              index: 1,
            }),
            [uuid()]: createItem('twoactions_checkmarkx', false, {
              sectionId,
              index: 0,
            }),
          },
          { [sectionId]: { section_type: 'multi' } }
        ),
        expected: undefined,
        message: 'non text input item yields no sub title',
      },
      {
        data: createInspection(
          {},
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              index: 1,
            }),
            [uuid()]: createTextInputItem({
              sectionId,
              itemType: 'text_input',
              index: 0,
              textInputValue: '',
            }),
          },
          { [sectionId]: { section_type: 'multi' } }
        ),
        expected: undefined,
        message: 'text input without value item yields no sub title',
      },
      {
        data: createInspection(
          {},
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              index: 0,
            }),
            [uuid()]: createTextInputItem({
              sectionId,
              itemType: 'text_input',
              index: 1,
              textInputValue: 'sub-title',
            }),
          },
          { [sectionId]: { section_type: 'multi' } }
        ),
        expected: undefined,
        message: 'non-first text input item yields no sub title',
      },
      {
        data: createInspection(
          {},
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              index: 1,
            }),
            [uuid()]: createTextInputItem({
              sectionId,
              itemType: 'text_input',
              index: 0,
              textInputValue: 'sub-title',
            }),
          },
          { [sectionId]: { section_type: 'multi' } }
        ),
        expected: 'sub-title',
        message: 'first text input item with value yields expected sub title',
      },
    ].forEach(({ data, expected, message }) => {
      const actual = createDeficientItems(data)[itemId];
      expect(actual.sectionSubtitle).to.equal(expected, message);
    });
  });

  it("should use last admin edit date as timestamp or fallback to inspection's last update date", () => {
    const itemId = uuid();
    const sectionId = uuid();
    const now = Date.now() / 1000;
    const newer = now;
    const older = now - 100000;

    [
      {
        data: createInspection(
          { updatedLastDate: now },
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              adminEdits: null,
            }),
          }
        ),
        expected: now,
        message: 'used inspection update date as timestamp fallback',
      },
      {
        data: createInspection(
          { updatedLastDate: older },
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              adminEdits: { [uuid()]: { edit_date: newer } },
            }),
          }
        ),
        expected: newer,
        message: 'used only admit edit date as timestamp',
      },
      {
        data: createInspection(
          { updatedLastDate: older },
          {
            [itemId]: createItem('twoactions_checkmarkx', true, {
              sectionId,
              adminEdits: {
                [uuid()]: { edit_date: older },
                [uuid()]: { edit_date: older },
                [uuid()]: { edit_date: older },
                [uuid()]: { edit_date: newer },
                [uuid()]: { edit_date: older },
              },
            }),
          }
        ),
        expected: newer,
        message: 'used latest admin edit as timestamp',
      },
    ].forEach(({ data, expected, message }) => {
      const actual = createDeficientItems(data)[itemId];
      expect(actual.itemDataLastUpdatedDate).to.equal(expected, message);
    });
  });

  it('should only return falsey values for whitelisted on the top level attributes', () => {
    const itemId = uuid();
    const actual = createDeficientItems(
      createInspection(
        {},
        { [itemId]: createItem('twoactions_checkmarkx', true) }
      )
    )[itemId];

    Object.keys(actual).forEach(attr => {
      if (attr !== 'itemMainInputSelection' && attr !== 'hasItemPhotoData') {
        expect(actual[attr], `field ${attr} is truthy`).to.be.ok;
      }
    });
  });

  it('should lookup and set the source items score', () => {
    const itemId = uuid();
    const expected = 9999;
    const item = createItem('fiveactions_onetofive', true, {
      mainInputSelection: 3,
      mainInputThreeValue: expected,
    });

    const actual = createDeficientItems(
      createInspection({}, { [itemId]: item })
    )[itemId].itemScore;
    expect(actual).to.equal(expected);
  });
});
