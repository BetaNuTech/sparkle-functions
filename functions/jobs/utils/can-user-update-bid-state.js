const assert = require('assert');

/**
 * Validate state attribute update
 * @param  {Object} update
 * @param  {Object} bid
 * @return {Object}
 */

module.exports = (update, bid) => {
  assert(update && typeof update === 'object', 'has update');
  assert(bid && typeof bid === 'object', 'has bid record');

  switch (update.state) {
    case 'approved': {
      if (
        bid.state === 'open' &&
        bid.costMax &&
        bid.costMin &&
        bid.startedAt &&
        bid.completedAt
      ) {
        return true;
      }

      return false;
    }
    case 'incomplete': {
      if (bid.state === 'approved') return true;
      return false;
    }
    case 'rejected': {
      if (bid.state === 'approved') return true;
      return false;
    }
    case 'completed': {
      if (bid.state === 'approved') return true;
      return false;
    }
    case 'open': {
      if (bid.state === 'rejected') return true;
      return false;
    }
    default:
      return true;
  }
};
