module.exports = {
 /**
  * Create a randomized inspection object
  * @param  {Object} config
  * @return {Object}
  */
  createInspection(config) {
    if (!config.property) {
      throw new Error('createInspection requires a `property`');
    }

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
  }
}
