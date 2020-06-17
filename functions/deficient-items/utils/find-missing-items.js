const assert = require('assert');

/**
 * Compare 2 versions of an inspection's deficient
 * item tree and return the deficient item ID's
 * that no longer exist in target tree
 * @param  {Object} source
 * @param  {Object} target
 * @return {String[]} - deprecated deficient item ID's
 */
module.exports = function findMissingItemIDs(source, target) {
  assert(source && typeof source === 'object', 'has source object');
  assert(target && typeof target === 'object', 'has target object');

  return Object.keys(source).filter(defItemID => {
    const { item } = source[defItemID];
    const [found] = Object.keys(target).filter(
      targetItemID => target[targetItemID].item === item
    );
    return !found;
  });
};
