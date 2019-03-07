const assert = require('assert');

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

    return Object.assign({
      creationDate: (now - offset),
      deficienciesExist: Math.random() > .5 ? true : false,
      inspectionCompleted: completed,
      inspector: `user-${offset * 2}`,
      inspectorName: 'test-user',
      itemsCompleted: completed ? items : (items / 2),
      score: Math.random() > .5 ? 100 : Math.random(),
      templateName: `test-${offset * 3}`,
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

  createSection(config = {}) {
    return Object.assign({
      added_multi_section: false,
      index: 0,
      section_type: 'single',
      title: 'Intro'
    }, config);
  }
}
