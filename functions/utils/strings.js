const assert = require('assert');

module.exports = {
  capitalize: toCapitalize,
  toCapitalize,
  toHumanize,
};

/**
 * Convert a string: Into A Title
 * @param  {String} str input
 * @return {String} - str transformed
 */
function toCapitalize(str) {
  assert(str && typeof str === 'string', 'has string');
  return `${str}`
    .toLowerCase()
    .split(' ')
    .map(s => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
    .join(' ');
}

/**
 * Convert camel case to human readable format
 * @param  {String} str
 * @return {String}
 */
function toHumanize(str) {
  assert(str && typeof str === 'string', 'has string');
  const words = `${str}`.match(/[A-Za-z][a-z]*/g) || [];
  return words.map(toCapitalize).join(' ');
}
