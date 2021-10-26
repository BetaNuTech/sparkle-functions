const assert = require('assert');
const userUtil = require('../../utils/user');

/**
 * Validate state attribute update
 * @param  {Object} user
 * @param  {Object} update
 * @param  {Object} bid
 * @param  {Object} job
 * @return {Object[]} errors [{path: String, message: String, type: String}]
 */
module.exports = (user, update, bid, job) => {
  assert(user && typeof user === 'object', 'has user instance');
  assert(update && typeof update === 'object', 'has update');
  assert(bid && typeof bid === 'object', 'has bid record');
  assert(job && typeof job === 'object', 'has job record');
  const errors = [];

  switch (update.state) {
    case 'approved': {
      if (bid.state !== 'open') {
        errors.push({
          path: 'state',
          message: 'bid must be open',
          type: 'conflict',
        });
      }

      if (!bid.costMax) {
        errors.push({
          path: 'costMax',
          message: 'bid requires max cost',
          type: 'conflict',
        });
      }

      if (!bid.costMin) {
        errors.push({
          path: 'costMin',
          message: 'bid requires min cost',
          type: 'conflict',
        });
      }

      if (!bid.startAt) {
        errors.push({
          path: 'startAt',
          message: 'bid requires start at date',
          type: 'conflict',
        });
      }

      if (!bid.completeAt) {
        errors.push({
          path: 'completeAt',
          message: 'bid requires complete at date',
          type: 'conflict',
        });
      }

      if (!bid.vendorW9) {
        errors.push({
          path: 'vendorW9',
          message: 'bid requires approval of vendor W9',
          type: 'conflict',
        });
      }

      if (!bid.vendorInsurance) {
        errors.push({
          path: 'vendorInsurance',
          message: 'bid requires approval of vendor insurance',
          type: 'conflict',
        });
      }

      const jobType = `${job.type || ''}`;
      const permissionLevel = userUtil.getLevelName(user);
      const canApproveBid = canUserApproveBidForJobType(
        permissionLevel,
        jobType
      );

      if (!canApproveBid) {
        errors.push({
          path: 'job',
          message:
            'You do not have permission to approve bids for jobs of this type',
          type: 'permission',
        });
      }

      break;
    }
    case 'incomplete': {
      if (bid.state !== 'approved') {
        errors.push({
          path: 'state',
          message: 'bid must be approved',
          type: 'conflict',
        });
      }
      break;
    }
    case 'rejected': {
      if (bid.state !== 'approved') {
        errors.push({
          path: 'state',
          message: 'bid must be approved',
          type: 'conflict',
        });
      }
      break;
    }
    case 'completed': {
      if (bid.state !== 'approved') {
        errors.push({
          path: 'state',
          message: 'bid must be approved',
          type: 'conflict',
        });
      }
      break;
    }
    case 'open': {
      if (bid.state !== 'rejected') {
        errors.push({
          path: 'state',
          message: 'bid must be rejected',
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
 * approve a bid based on the job type
 * @param  {String} permissionLevel
 * @param  {String} jobType
 * @return {Boolean}
 */
function canUserApproveBidForJobType(permissionLevel, jobType) {
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
