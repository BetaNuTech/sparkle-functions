const config = require('../../config');

/**
 * Find the best matching status from available list statuses
 * @param  {String} sparkleState - Sparkle state to map
 * @param  {Array} availableStatuses - Array of available statuses from the list
 * @param  {String} type - 'deficiency' or 'job'
 * @return {String} Best matching status name
 */
module.exports = function getBestStatusMatch(sparkleState, availableStatuses, type = 'deficiency') {
  const { clickup } = config;
  const mapping = type === 'job' ? clickup.jobStatusMapping : clickup.deficientItemStatusMapping;
  
  // First try exact match from mapping
  const idealStatus = mapping[sparkleState];
  if (idealStatus) {
    const exactMatch = availableStatuses.find(
      s => s.status.toUpperCase() === idealStatus.toUpperCase()
    );
    if (exactMatch) return exactMatch.status;
  }
  
  // Fallback strategies based on status type
  const statusTypeMap = {
    'requires-action': 'open',
    'go-back': 'open',
    'pending': 'custom',
    'requires-progress-update': 'custom',
    'overdue': 'custom',
    'completed': 'done',
    'incomplete': 'unstarted',
    'deferred': 'unstarted',
    'closed': 'closed',
    // Jobs
    'open': 'open',
    'approved': 'custom',
    'authorized': 'done',
    'complete': 'closed'
  };
  
  const desiredType = statusTypeMap[sparkleState];
  
  // Find status with matching type
  const typeMatch = availableStatuses.find(s => s.type === desiredType);
  if (typeMatch) return typeMatch.status;
  
  // Final fallback - return first open status or first available
  const openStatus = availableStatuses.find(s => s.type === 'open');
  return openStatus ? openStatus.status : (availableStatuses[0] && availableStatuses[0].status) || 'to do';
};