const assert = require('assert');
const Schema = require('validate');

const isValidCost = (value, ctx) => {
  return value && (ctx.costMax || ctx.costMin)
    ? value > ctx.costMax || value < ctx.costMin
    : true;
};

/**
 * Validate minimum cost
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCostMin = (value, ctx) => {
  if (!value) return true;

  if (ctx.costMax) {
    return value < ctx.costMax;
  }

  return value >= 0;
};

/**
 * Validate maximum cost
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCostMax = (value, ctx) => {
  if (!value) return true;

  if (ctx.costMin) {
    return value > ctx.costMin;
  }

  return value >= 0;
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
    use: { isValidCostMin },
  },
  costMax: {
    type: Number,
    required: false,
    use: { isValidCostMax },
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
 * @param {Object} bid
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = bid => {
  assert(bid && typeof bid, 'has bid instance');
  const clone = JSON.parse(JSON.stringify(bid));
  return bidSchema.validate(clone);
};
