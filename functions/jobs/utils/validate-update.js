const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');

const jobSchema = new Schema({
  title: {
    type: String,
  },
  need: {
    type: String,
  },
  authorizedRules: {
    type: String,
    enum: config.jobs.authorizedRuleTypes,
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
    enum: config.jobs.typeValues,
  },
});

/**
 * Validate a def
 * @param {Object} jobUpdate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = jobUpdate => {
  assert(jobUpdate && typeof jobUpdate, 'has job update');
  return jobSchema.validate(jobUpdate);
};
