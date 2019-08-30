const assert = require('assert');

/**
 * Find any previous state history hash
 * @param  {Object} deficientItem
 * @return {Object}
 */
module.exports = function findHistory(deficientItem) {
  assert(
    deficientItem && typeof deficientItem === 'object',
    'has deficient item instance'
  );

  return historyName => {
    assert(
      historyName && typeof historyName === 'string',
      'has history hash name'
    );

    const historyItems = [];
    const history = deficientItem[historyName];

    if (history && typeof history === 'object') {
      // Add all history states w/ numeric `createdAt`
      const tmpHistoryItems = Object.keys(history)
        .map(id => history[id])
        .filter(({ createdAt }) => typeof createdAt === 'number');

      // Sort in descending order & add to history items
      historyItems.push(
        ...tmpHistoryItems.sort((a, b) => b.createdAt - a.createdAt)
      );
    }

    return {
      /**
       * Next most recent history state
       * @return {Object}
       */
      get previous() {
        return historyItems[1] || null;
      },

      /**
       * Most recent history state
       * @return {Object}
       */
      get current() {
        return historyItems[0] || null;
      },
    };
  };
};
