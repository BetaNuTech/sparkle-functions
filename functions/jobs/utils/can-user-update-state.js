const assert = require('assert');
const config = require('../../config');

const { authorizedRuleTypes: AUTH_RULE_TYPES } = config.jobs;

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

      const isLargeRules = job.authorizedRules === AUTH_RULE_TYPES[2];
      const isExpeditedRules = job.authorizedRules === AUTH_RULE_TYPES[1];
      const minBids = job.minBids || Infinity;
      const hasMetMinBidReq = bids.length >= minBids;
      const hasMetApprovedBidReq =
        bids.filter(bid => bid.state === 'approved').length > 0;

      // Expedited job
      if (isExpeditedRules) {
        return user.admin && hasMetMinBidReq && hasMetApprovedBidReq;
      }

      // Large job
      if (isLargeRules) {
        return user.admin && hasMetMinBidReq && hasMetApprovedBidReq;
      }

      // Default job
      return hasMetApprovedBidReq && hasMetMinBidReq;
    }
    case 'complete': {
      if (job.state === 'authorized') return true;
      return false;
    }
    default:
      return true;
  }
};
