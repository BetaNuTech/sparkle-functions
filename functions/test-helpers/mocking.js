const assert = require('assert');
const config = require('../config');

const INSPECTION_SCORES = config.inspectionItems.scores;
const DEFICIENT_LIST_ELIGIBLE = config.inspectionItems.deficientListEligible;
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

module.exports = {
 /**
  * Create a randomized inspection object
  * @param  {Object} config
  * @return {Object}
  */
  createInspection(config) {
    assert(Boolean(config.property, 'has a `config.property` id'))

    const now = Date.now() / 1000;
    const offset = Math.floor(Math.random() * 100);
    const items = Math.floor(Math.random() * 100);
    const completed = config.inspectionCompleted || false;
    const templateName = `test-${offset * 3}`;

    return Object.assign({
      creationDate: (now - offset),
      deficienciesExist: Math.random() > .5 ? true : false,
      inspectionCompleted: completed,
      inspector: `user-${offset * 2}`,
      inspectorName: 'test-user',
      itemsCompleted: completed ? items : (items / 2),
      score: Math.random() > .5 ? 100 : Math.random(),
      templateName,
      template: {
        trackDeficientItems: false,
        name: templateName,
        sections: {},
        items: {}
      },
      totalItems: items,
      updatedLastDate: (now - (offset / 2))
    }, config);
  },

  createItem(config = {}) {
    assert(Boolean(config.sectionId), 'has config with sectionId');

    return Object.assign({
      index: 0,
      isItemNA: false,
      isTextInputItem: true,
      mainInputFourValue: 0,
      mainInputOneValue: 0,
      mainInputSelected: true,
      mainInputThreeValue: 0,
      mainInputTwoValue: 0,
      mainInputZeroValue: 3,
      sectionId: config.sectionId,
      textInputValue: '1',
      title: 'Unit #:'
    }, config);
  },

  /**
   * Create completed main input type item
   * allow setting for deficient for given type
   * @param  {String}  type
   * @param  {Boolean} deficient
   * @param  {Object}  item
   * @return {Object} - completed main input item object
   */
  createCompletedMainInputItem(type = 'twoactions_checkmarkx', deficient = false, item = {}) {
    assert(Boolean(INSPECTION_SCORES[type]), 'has valid main input type');
    assert(typeof deficient === 'boolean', 'has boolean deficient');
    assert(item && typeof item === 'object', 'has object item');

    // Validate mocked selection or
    // lookup selection based on deficiency
    // list eligiblity
    let selection = 0;
    if (typeof item.mainInputSelection === 'number') {
      assert(ITEM_VALUE_NAMES[item.mainInputSelection], 'has valid main input selection');
      assert(typeof INSPECTION_SCORES[type][item.mainInputSelection] === 'number', 'has valid score selection');
      selection = item.mainInputSelection;
    } else if (DEFICIENT_LIST_ELIGIBLE[type]) {
      selection = DEFICIENT_LIST_ELIGIBLE[type].lastIndexOf(
        deficient
      ) || 0;
    } else {
      selection = null;
    }

    const itemValues = {
      mainInputZeroValue: 0,
      mainInputOneValue: 0,
      mainInputTwoValue: 0,
      mainInputThreeValue: 0,
      mainInputFourValue: 0
    };

    INSPECTION_SCORES[type].forEach((score, i) => {
      itemValues[ITEM_VALUE_NAMES[i]] = score;
    });

    return Object.assign(
      {
        deficient,
        index: 0,
        isItemNA: false,
        itemType: 'main',
        isTextInputItem: false,
        mainInputSelected: true,
        mainInputSelection: selection,
        mainInputType: type,
        sectionId: '-uK6',
        textInputValue: '',
        title: 'e',
        notes: true,
        photos: true
      },
      itemValues,
      item
    );
  },

  createDeficientItem(inspectionId, itemId, item = {}) {
    assert(inspectionId && typeof inspectionId === 'string', 'has inspection id');
    assert(itemId && typeof itemId === 'string', 'has item id');
    assert(item && typeof item === 'object', 'has object item');

    return Object.assign({
      state: 'requires-action' // TODO #81
    }, item, {
      inspection: inspectionId,
      item: itemId
    });
  },

  createSection(config = {}) {
    return Object.assign({
      added_multi_section: false,
      index: 0,
      section_type: 'single',
      title: 'Intro'
    }, config);
  }
}
