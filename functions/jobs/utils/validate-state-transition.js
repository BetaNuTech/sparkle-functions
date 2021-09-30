const assert = require('assert');
const config = require('../../config');

const { authorizedRuleTypes: AUTH_RULE_TYPES } = config.jobs;

/**
 * Check permission and validate state attribute update
 * @param  {String} targetState
 * @param  {Object} job
 * @param  {Object[]} bids
 * @param  {Object} user
 * @return {Object[]} - { path: string, message: string }
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
  const jobAttachments = job.scopeOfWorkAttachments || [];
  const hasScopeOfWork = Boolean(job.scopeOfWork || jobAttachments.length);
  const result = [];

  switch (targetState) {
    case 'approved': {
      if (job.state !== 'open') {
        result.push({
          path: 'state',
          message: 'Cannot approve job unopend job',
        });
      }

      if (!hasScopeOfWork) {
        result.push({
          path: 'scopeOfWork',
          message: 'Cannot approve job missing scope of work or attachment',
        });
      }
      break;
    }
    case 'authorized': {
      if (job.state !== 'approved') {
        result.push({
          path: 'state',
          message: 'Cannot authorized job that has not been approved',
        });
      }

      if (!hasScopeOfWork) {
        result.push({
          path: 'scopeOfWork',
          message: 'Cannot authorized job missing scope of work or attachment',
        });
      }

      const isLargeRules = job.authorizedRules === AUTH_RULE_TYPES[2];
      const isExpeditedRules = job.authorizedRules === AUTH_RULE_TYPES[1];
      const minBids = job.minBids || Infinity;
      const hasMetMinBidReq = bids.length >= minBids;
      const hasMetApprovedBidReq =
        bids.filter(bid => bid.state === 'approved').length > 0;

      // Expedited job
      if (isExpeditedRules && !user.admin) {
        result.push({
          path: 'admin',
          message: 'Only admins can authorize an expedited job',
        });
      }

      // Large job
      if (isLargeRules && !user.admin) {
        result.push({
          path: 'admin',
          message: 'Only admins can authorize a large job',
        });
      }

      if (!hasMetApprovedBidReq) {
        result.push({
          path: 'bids',
          message: 'Cannot authorize a job without an approved bid',
        });
      }

      if (!hasMetMinBidReq) {
        result.push({
          path: 'minBids',
          message: `Cannot authorize a job without at least ${minBids} bid${
            minBids > 1 ? 's' : ''
          }`,
        });
      }
      break;
    }
    case 'complete': {
      if (job.state !== 'authorized') {
        result.push({
          path: 'state',
          message: 'Cannot complete job that has not been authorized',
        });
      }
      break;
    }
    default:
      break;
  }

  return result;
};
