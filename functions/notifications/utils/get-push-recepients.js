const assert = require('assert');

/**
 * Create an array of valid recepient ID's
 * for push notifications
 * @param  {Object[]} users
 * @param  {Array}    excludes
 * @param  {Boolean}  allowCorp
 * @param  {String}   property
 * @return {String[]}
 */
module.exports = function getPushRecepients({
  users,
  excludes = [],
  allowCorp = false,
  allowTeamLead = false,
  property,
}) {
  assert(
    Array.isArray(users) && users.every(u => typeof u === 'object'),
    'has users configurations'
  );
  assert(
    Array.isArray(excludes) && excludes.every(id => typeof id === 'string'),
    'has excludes user IDs'
  );

  return (
    users
      .map(user => {
        const { admin, corporate } = user;
        const properties = Object.keys(user.properties || {});
        const teamProperties = [].concat(
          ...Object.values(user.teams || {}).map(t => {
            return typeof t === 'object' ? Object.keys(t || {}) : [];
          })
        );
        const isTeamLead = Boolean(teamProperties.length);

        // Add all admins
        if (admin) {
          return user.id;
        }

        // Add whitelisted, non-team lead, corporate users
        if (allowCorp && corporate && !isTeamLead) {
          return user.id;
        }

        // Add whitelisted user-group of specified property
        if (property && properties.includes(property)) {
          return user.id;
        }

        // Is a team lead of this property
        if (allowTeamLead && property && teamProperties.includes(property)) {
          return user.id;
        }

        return '';
      })
      // Remove falsey or excluded users
      .filter(id => id && !excludes.includes(id))
  );
};
