const assert = require('assert');
const Schema = require('validate');

/**
 * Validate minimum cost
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCostMin = (value, ctx) => {
  if (!value) return true;

  if (ctx.costMax) {
    return value <= ctx.costMax;
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
    return value >= ctx.costMin;
  }

  return value >= 0;
};

const isValidCompleteOrStartAt = (value, ctx) => {
  return value && (ctx.completeAt || ctx.startAt)
    ? value < ctx.completeAt || value > ctx.startAt
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
  startAt: {
    type: Number,
    required: false,
    use: { isValidCompleteOrStartAt },
  },
  completeAt: {
    type: Number,
    required: false,
    use: { isValidCompleteOrStartAt },
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
