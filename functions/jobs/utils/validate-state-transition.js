const assert = require('assert');
const config = require('../../config');
const userUtil = require('../../utils/user');

const { authorizedRuleTypes: AUTH_RULE_TYPES } = config.jobs;

/**
 * Check permission and validate state attribute update
 * @param  {String} targetState
 * @param  {Object} job
 * @param  {Object[]} bids
 * @param  {Object} user
 * @return {Object[]} errors [{path: String, message: String, type: String}]
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
  const errors = [];

  switch (targetState) {
    case 'approved': {
      if (job.state !== 'open') {
        errors.push({
          path: 'state',
          message: 'Cannot approve job unopend job',
          type: 'conflict',
        });
      }

      if (!hasScopeOfWork) {
        errors.push({
          path: 'scopeOfWork',
          message: 'Cannot approve job missing scope of work or attachment',
          type: 'conflict',
        });
      }

      const jobType = `${job.type || ''}`;
      const permissionLevel = userUtil.getLevelName(user);
      const canApproveJob = canUserApproveForJobType(permissionLevel, jobType);

      if (!canApproveJob) {
        errors.push({
          path: 'type',
          message:
            'You do not have permission to approve bids for jobs of this type',
          type: 'permission',
        });
      }
      break;
    }
    case 'authorized': {
      if (job.state !== 'approved') {
        errors.push({
          path: 'state',
          message: 'Cannot authorized job that has not been approved',
          type: 'conflict',
        });
      }

      if (!hasScopeOfWork) {
        errors.push({
          path: 'scopeOfWork',
          message: 'Cannot authorized job missing scope of work or attachment',
          type: 'conflict',
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
        errors.push({
          path: 'admin',
          message: 'Only admins can authorize an expedited job',
          type: 'permission',
        });
      }

      // Large job
      if (isLargeRules && !user.admin) {
        errors.push({
          path: 'admin',
          message: 'Only admins can authorize a large job',
          type: 'permission',
        });
      }

      if (!hasMetApprovedBidReq) {
        errors.push({
          path: 'bids',
          message: 'Cannot authorize a job without an approved bid',
          type: 'conflict',
        });
      }

      if (!hasMetMinBidReq) {
        errors.push({
          path: 'minBids',
          message: `Cannot authorize a job without at least ${minBids} bid${
            minBids > 1 ? 's' : ''
          }`,
          type: 'conflict',
        });
      }
      break;
    }
    case 'complete': {
      if (job.state !== 'authorized') {
        errors.push({
          path: 'state',
          message: 'Cannot complete job that has not been authorized',
          type: 'conflict',
        });
      }
      break;
    }
    default:
      break;
  }

  return errors;
};

/**
 * Determines if a user's permission level can allow
 * approving a job based on its' type
 * @param  {String} permissionLevel
 * @param  {String} jobType
 * @return {Boolean}
 */
function canUserApproveForJobType(permissionLevel, jobType) {
  assert(
    permissionLevel && typeof permissionLevel === 'string',
    'has user permission level string'
  );
  assert(jobType && typeof jobType === 'string', 'has job type string');

  // Accept all admin approvals of all bids
  if (permissionLevel === 'admin') {
    return true;
  }

  // Only accept corporate approvals of small job bids
  if (['teamLead', 'corporate'].includes(permissionLevel)) {
    return jobType.search(/^small/i) === 0;
  }

  // Only accept property manager approvals of small pm job bids
  if (permissionLevel === 'propertyMember') {
    return jobType === 'small:pm';
  }

  // Reject no access
  return false;
}
