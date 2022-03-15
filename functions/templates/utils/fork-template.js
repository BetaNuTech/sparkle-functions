const assert = require('assert');
const uuid = require('../../utils/short-uuid');

/**
 * Change template item/section ID's
 * and set the item versions back to zero
 * @param  {String} templateId
 * @param  {Object} template
 * @return {Object} - new template
 */
module.exports = function createForkedTemplate(templateId, template) {
  assert(
    templateId && typeof templateId === 'string',
    'has template indentifier'
  );
  assert(template && typeof template === 'object', 'has template');
  assert(
    template.items && typeof template.items === 'object',
    'has template items'
  );
  assert(
    template.sections && typeof template.sections === 'object',
    'has template sections'
  );

  const result = deepClone(template);
  result.clone = templateId;

  // Reset sections
  Object.keys(result.sections).forEach(sectionId => {
    const section = deepClone(result.sections[sectionId]);
    delete result.sections[sectionId]; // set unique identifier
    result.sections[uuid(20)] = {
      ...section,
      clone: sectionId,
    };
  });

  // Reset items
  Object.keys(result.items).forEach(itemId => {
    const item = deepClone(result.items[itemId]);
    item.version = 0; // reset version
    delete result.items[itemId]; // set unique identifier
    result.items[uuid(20)] = {
      ...item,
      clone: itemId,
    };
  });

  return result;
};

/**
 * Clone an object
 * @param  {Object} obj
 * @return {Object} - cloned
 */
function deepClone(obj = {}) {
  return JSON.parse(JSON.stringify(obj));
}
