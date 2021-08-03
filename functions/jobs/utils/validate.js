const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');

const jobSchema = new Schema({
  id: {
    type: String,
    required: false,
  },
  title: {
    type: String,
    required: true,
  },
  need: {
    type: String,
    required: true,
  },
  authorizedRules: {
    type: String,
    enum: config.jobs.authorizedRuleTypes,
    required: true,
  },
  scopeOfWork: {
    type: String,
    required: true,
  },
  trelloCardURL: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Number,
    required: true,
  },
  updatedAt: {
    type: Number,
    required: true,
  },
  state: {
    type: String,
    enum: config.jobs.stateTypes,
    required: true,
  },
  type: {
    type: String,
    enum: config.jobs.typeValues,
    required: true,
  },
});

/**
 * Validate a def
 * @param {Object} job
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = job => {
  assert(job && typeof job, 'has job instance');
  const clone = JSON.parse(JSON.stringify(job));
  return jobSchema.validate(clone);
};
