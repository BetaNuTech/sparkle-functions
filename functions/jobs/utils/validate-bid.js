const assert = require('assert');
const Schema = require('validate');

const isValidCost = (value, ctx) => {
  return value && (ctx.costMax || ctx.costMin)
    ? value > ctx.costMax || value < ctx.costMin
    : true;
};

const isValidCompletedOrStartedAt = (value, ctx) => {
  return value && (ctx.completedAt || ctx.startedAt)
    ? value < ctx.completedAt || value > ctx.startedAt
    : true;
};

const bidSchema = new Schema({
  vendor: {
    type: String,
    required: true,
  },
  vendorDetails: {
    type: String,
    required: false,
  },
  costMin: {
    type: Number,
    required: false,
    use: { isValidCost },
  },
  costMax: {
    type: Number,
    required: false,
    use: { isValidCost },
  },
  startedAt: {
    type: Number,
    required: false,
    use: { isValidCompletedOrStartedAt },
  },
  completedAt: {
    type: Number,
    required: false,
    use: { isValidCompletedOrStartedAt },
  },
});

/**
 * Validate a def
 * @param {Object} bidCreate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = bidCreate => {
  assert(bidCreate && typeof bidCreate, 'has bid create');
  return bidSchema.validate(bidCreate);
};
