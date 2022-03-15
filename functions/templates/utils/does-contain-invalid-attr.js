const assert = require('assert');

const VALID_ATTRS = [
  'name',
  'description',
  'category',
  'trackDeficientItems',
  'requireDeficientItemNoteAndPhoto',
  'sections',
  'items',
];

/**
 * Check if template payload contains non-updatable attributes
 * @param  {Object} update
 * @return {Boolean}
 */
module.exports = update => {
  assert(update && typeof update === 'object', 'has update object');

  return Object.keys(update).some(key => !VALID_ATTRS.includes(key));
};
