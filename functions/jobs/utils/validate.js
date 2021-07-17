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
  property: {
    type: Object,
    required: true,
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
 * @param {Object} jobCreate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = jobCreate => {
  assert(jobCreate && typeof jobCreate, 'has job create');
  return jobSchema.validate(jobCreate);
};
