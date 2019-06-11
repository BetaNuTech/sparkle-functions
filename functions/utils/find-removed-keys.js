/**
 * Create list of keys no longer in current object
 * @param  {Object} prev
 * @param  {Object} current
 * @return {String[]} - removed ID's
 */
module.exports = function findRemoved(prev, current) {
  const keysRemoved = [];

  Object.keys(prev).forEach(key => {
    if (!current || !current[key]) {
      keysRemoved.push(key);
    }
  });

  return keysRemoved;
};
