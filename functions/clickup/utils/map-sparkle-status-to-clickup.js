const config = require('../../config');

/**
 * Map Sparkle deficient item or job status to ClickUp status
 * @param  {String} sparkleState - Sparkle state
 * @param  {String} type - 'deficiency' or 'job'
 * @return {String} ClickUp status
 */
module.exports = function mapSparkleStatusToClickUp(sparkleState, type = 'deficiency') {
  const { clickup } = config;
  
  if (type === 'job') {
    return clickup.jobStatusMapping[sparkleState] || 'to do';
  }
  
  return clickup.deficientItemStatusMapping[sparkleState] || 'to do';
};