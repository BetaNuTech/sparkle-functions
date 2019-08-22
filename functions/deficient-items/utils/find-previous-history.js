const assert = require('assert');

/**
 * Find any previous state history hash
 * @param  {Object} deficientItem
 * @return {Object}
 */
module.exports = function findPreviousHistory(deficientItem) {
  assert(
    deficientItem && typeof deficientItem === 'object',
    'has deficient item instance'
  );

  return historyName => {
    assert(
      historyName && typeof historyName === 'string',
      'has history hash name'
    );

    let result = null;
    const history = deficientItem[historyName];

    if (!history || typeof history !== 'object') {
      return result;
    }

    const historyItems = Object.keys(history).map(id => history[id]);

    // Do not compare non-historical hashes
    if (!historyItems.every(({ createdAt }) => typeof createdAt === 'number')) {
      return result;
    }

    // Sort in descending order & select 2nd item
    result = historyItems.sort((a, b) => b.createdAt - a.createdAt)[1];

    return result || null;
  };
};
