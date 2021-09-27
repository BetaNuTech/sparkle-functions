const assert = require('assert');
const config = require('../../config');

const { authorizedRuleTypes: AUTH_RULE_TYPES } = config.jobs;

module.exports = {
  /**
   * Count the number of bids required
   * a specified authorize rule set
   * @param   {String} authorizedRule
   * @returns {Number} minBids
   */
  getMinBids(authorizedRule) {
    assert(
      authorizedRule && typeof authorizedRule === 'string',
      'authorized rule has string value'
    );

    let minBids = 2; // default
    const isLargeRules = authorizedRule === AUTH_RULE_TYPES[2];
    const isExpeditedRules = authorizedRule === AUTH_RULE_TYPES[1];

    if (isLargeRules) {
      minBids = 3;
    } else if (isExpeditedRules) {
      minBids = 1;
    }

    return minBids;
  },

  /**
   * Updates the job's authorized rules
   * based on the type the job is updating
   * @param {Object} update - current request payload to be updated
   * @param {String} type - type refrence of current job type
   * @returns {String} - applicable auth rule
   */
  getAuthorizedRules(authorizedRules, type) {
    assert(
      authorizedRules && typeof authorizedRules === 'string',
      'has authorized rules string'
    );
    assert(type && typeof type === 'string', 'has type string');

    let update = AUTH_RULE_TYPES[0]; // default
    const isExpedited = authorizedRules === AUTH_RULE_TYPES[1];

    // Check type begins with word "large"
    const isLargeType = type.search('large') === 0;

    // Update authorized rules to large as long
    // as the job is not becoming/is expedited
    if (isExpedited) {
      update = AUTH_RULE_TYPES[1];
    } else if (isLargeType) {
      update = AUTH_RULE_TYPES[2];
    }

    return update;
  },
};
