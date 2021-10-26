const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');

/**
 * Determin if job has valid type
 * @param  {String} value
 * @return {Boolean}
 */
const validateJobType = value => {
  const currentRegex = [
    { reg: /^large/ },
    { reg: /^medium/ },
    { reg: /^small/ },
  ];

  for (let i = 0; i < currentRegex.length; i++) {
    const type = currentRegex[i];

    if (type.reg.test(value)) {
      return true;
    }
  }

  return false;
};

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
  },
  authorizedRules: {
    type: String,
    required: true,
  },
  scopeOfWork: {
    type: String,
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
    required: true,
    use: { validateJobType },
  },
  minBids: {
    type: Number,
  },
  expediteReason: {
    type: String,
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
