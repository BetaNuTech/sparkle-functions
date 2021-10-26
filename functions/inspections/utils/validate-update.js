const assert = require('assert');
const Schema = require('validate');

const inspectionSchema = new Schema({
  template: {
    type: Object,
  },
});

/**
 * Validate a def
 * @param {Object} update
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = update => {
  assert(update && typeof update, 'has inspection update');
  const clone = JSON.parse(JSON.stringify(update));
  return inspectionSchema.validate(clone);
};
