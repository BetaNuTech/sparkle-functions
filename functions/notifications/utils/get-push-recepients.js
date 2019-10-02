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

        // Add all admins
        if (admin) {
          return user.id;
        }

        // Add whitelisted corporate users
        if (allowCorp && corporate) {
          return user.id;
        }

        // Add whitelisted user-group of specified property
        if (property && properties.includes(property)) {
          return user.id;
        }

        return '';
      })
      // Remove falsey or excluded users
      .filter(id => id && !excludes.includes(id))
  );
};
