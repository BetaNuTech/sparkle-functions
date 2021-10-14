const assert = require('assert');
const { toCapitalize } = require('./strings');

module.exports = {
  getFullName,
  getLevelName,
  getProperties,
  getLeadershipProperties,
};

/**
 * Format full name
 * @param  {Object} user
 * @return {String}
 */
function getFullName(user) {
  assert(user && typeof user === 'object', 'has user object');
  return [`${user.firstName || ''}`.trim(), `${user.lastName || ''}`.trim()]
    .filter(Boolean)
    .map(toCapitalize)
    .join(' ')
    .trim();
}

/**
 * Discovers the permission level of a user
 * returns a name to be associated with their access
 * @param  {Object} user
 * @return {String}
 */
function getLevelName(user) {
  assert(user && typeof user === 'object', 'has user object');
  const hasLeadershipTeams =
    getLeadershipProperties(user.teams || {}).length > 0;
  const hasPropertyMemberships =
    getProperties(user.properties || {}).length > 0;

  if (user.admin) {
    return 'admin';
  }

  if (hasLeadershipTeams) {
    return 'teamLead';
  }

  if (user.corporate) {
    return 'corporate';
  }

  if (hasPropertyMemberships) {
    return 'propertyMember';
  }

  return 'noAccess';
}

/**
 * Create flat array of all user's
 * property's that they are team lead of.
 * Team leads have access to all the
 * nested properties under their teams hash
 * @param {Object?} userTeams
 * @return {String[]} - users property associations from their team leadship role
 */
function getLeadershipProperties(userTeams = {}) {
  assert(userTeams && typeof userTeams === 'object', 'has user teams object');

  return [].concat(
    ...Object.values(userTeams || {})
      .filter(team => typeof team === 'object')
      .map(teamHash => Object.keys(teamHash))
  );
}

/**
 * Create array of all a users property memberships id's
 * @param  {Object?} userProperties
 * @return {String[]} - user's property id's
 */
function getProperties(userProperties = {}) {
  assert(
    userProperties && typeof userProperties === 'object',
    'has user properties object'
  );
  return Object.keys(userProperties || {});
}
