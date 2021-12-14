const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;

module.exports = {
  /**
   * Convert a hash to firestore
   * compatable deletes
   * @param {Object} src
   * @param {String} prefix
   */
  getDeleteWrites(src, prefix = '') {
    assert(src && typeof src === 'object');
    assert(typeof prefix === 'string');

    const result = {};

    // Convert all null values to deletes
    Object.keys(src).forEach(id => {
      const value = src[id];

      if (value === null) {
        result[`${prefix}${prefix ? '.' : ''}${id}`] = FieldValue.delete();
      }
    });

    return result;
  },

  /**
   * Modifies provided object
   * by deleting the null values
   * @param {Object} src [description]
   */
  removeNulls(src = {}) {
    assert(src && typeof src === 'object');

    Object.keys(src).forEach(id => {
      if (src[id] === null) {
        delete src[id];
      }
    });
  },
};
