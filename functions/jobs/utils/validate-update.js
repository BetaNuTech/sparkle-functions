const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');
const deepClone = require('../../utils/deep-clone');

const jobSchema = new Schema({
  title: {
    type: String,
  },
  need: {
    type: String,
  },
  authorizedRules: {
    type: String,
  },
  scopeOfWork: {
    type: String,
  },
  state: {
    type: String,
    enum: config.jobs.stateTypes,
  },
  type: {
    type: String,
  },
  trelloCardURL: {
    type: String,
  },
});

/**
 * Validate a def
 * @param {Object} update
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = update => {
  assert(update && typeof update, 'has job update');
  const clone = deepClone(update);
  return jobSchema.validate(clone);
};
