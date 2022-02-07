/**
 * Generate a short length id
 * @param  {Number} len
 * @return {String}
 */
module.exports = function uuid(len = 20) {
  if (typeof len !== 'number' || len !== len || len < 1) {
    throw Error('utils: uuid: invalid length argument');
  }
  return [...Array(len)]
    .map(() => 'x')
    .join('')
    .replace(/[x]/g, generateChar);
};

/**
 * Generate a random charater
 * @param  {String} c
 * @return {String}
 */
function generateChar(c) {
  const r = (Math.random() * 16) | 0; // eslint-disable-line
  const v = c === 'x' ? r : (r & 0x3) | 0x8; // eslint-disable-line
  return v.toString(16);
}
