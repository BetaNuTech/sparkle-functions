const assert = require('assert');

/**
 * Check permission and validate state attribute update
 * @param  {String} targetState
 * @param  {Object} job
 * @param  {Object[]} bids
 * @param  {Object} user
 * @return {Boolean}
 */

module.exports = (targetState, job, bids, user) => {
  assert(targetState && typeof targetState === 'string', 'has targeted state');
  assert(job && typeof job === 'object', 'has job record');
  assert(bids && typeof bids === 'object', 'has bids record');
  assert(user && typeof user === 'object', 'has user record');

  switch (targetState) {
    case 'approved': {
      if (job.state === 'open') return true;
      return false;
    }
    case 'authorized': {
      const approvedBids = bids.reduce((total, bid) => {
        return total + (bid.state === 'approved' ? 1 : 0);
      }, 0);
      if (job.state !== 'approved') return false;

      // Regular job
      if (approvedBids >= 1 && bids.length >= 3) {
        return true;
      }

      // Expedited job
      if (
        user.admin &&
        job.authorizedRules === 'expedite' &&
        approvedBids >= 1 &&
        bids.length >= 1
      ) {
        return true;
      }

      return false;
    }
    case 'complete': {
      if (job.state === 'authorized') return true;
      return false;
    }
    default:
      return true;
  }
};
