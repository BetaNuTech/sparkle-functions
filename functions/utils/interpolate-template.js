const assert = require('assert');

/**
 * Interpolate hash of values into a template
 * @param  {String} template
 * @return {Function}
 */
module.exports = function createTemplate(template) {
  assert(template && typeof template === 'string', 'has template string');

  /**
   * Interpolator
   * @param  {Object?} data
   * @return {String}
   */
  return (data = {}) => {
    assert(data && typeof data === 'object', 'has data hash');

    let result = `${template}`;

    Object.keys(data).forEach(name => {
      const value = `${data[name]}`;
      result = result.replace(new RegExp(`{{${name}}}`, 'g'), value);
    });

    return result;
  };
};
