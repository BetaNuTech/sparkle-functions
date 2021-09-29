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
  assert(bids && Array.isArray(bids), 'has bids array');
  assert(
    bids.every(bid => typeof bid === 'object'),
    'has array of bid objects'
  );
  assert(user && typeof user === 'object', 'has user record');

  switch (targetState) {
    case 'approved': {
      if (job.state === 'open') return true;
      return false;
    }
    case 'authorized': {
      if (job.state !== 'approved') return false;

      const approvedBids = bids.reduce(
        (total, bid) => total + (bid.state === 'approved' ? 1 : 0),
        0
      );
      const minBids = job.minBids || Infinity;
      const hasMetApprovedBidReq = approvedBids >= 1;
      const hasMetBidRequirement = bids.length >= minBids;

      // Expedited job
      if (job.authorizedRules === 'expedite') {
        return user.admin && hasMetBidRequirement && hasMetBidRequirement;
      }

      // Large job
      if (job.authorizedRules === 'large') {
        return user.admin && hasMetBidRequirement && hasMetBidRequirement;
      }

      // Default job
      return hasMetApprovedBidReq && hasMetBidRequirement;
    }
    case 'complete': {
      if (job.state === 'authorized') return true;
      return false;
    }
    default:
      return true;
  }
};
