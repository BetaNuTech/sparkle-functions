/**
 * Copy specified template attributes into an
 * abbreviated proxy record
 * @param  {Object} template
 * @return {Object} - template copy
 */
module.exports = function createProxy(template) {
  const templateCopy = {};

  // Required attributes
  templateCopy.name = template.name || '';

  // Add optional attributes
  if (template.description) {
    templateCopy.description = template.description;
  }

  if (template.category) {
    templateCopy.category = template.category;
  }

  return templateCopy;
};
