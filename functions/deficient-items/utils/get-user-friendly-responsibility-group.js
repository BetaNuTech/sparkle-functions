const { responsibilityGroups } = require('../../config/deficient-items');

/**
 * Get a user facing value of system's
 * responsibility group
 * @param  {String} systemValue?
 * @return {String}
 */
module.exports = function getUserFriendlyResponsibilityGroup(systemValue) {
  return responsibilityGroups[systemValue] || '';
};
