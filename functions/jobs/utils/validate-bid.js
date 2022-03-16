const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');

/**
 * Validate minimum cost
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCostMin = (value, ctx) => {
  if (typeof value !== 'number') {
    return true; // unanswered
  }

  if (value === 0) {
    return true; // unset answer
  }

  return ctx.costMax ? value <= ctx.costMax : Boolean(value);
};

/**
 * Validate maximum cost
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCostMax = (value, ctx) => {
  if (typeof value !== 'number') {
    return true; // unanswered
  }

  if (value === 0) {
    return true; // unset answer
  }

  return ctx.costMin ? value >= ctx.costMin : Boolean(value);
};

/**
 * Validate bid start at timestamp
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidStartAt = (value, ctx) => {
  if (typeof value !== 'number') {
    return true; // unanswered
  }

  if (value === 0) {
    return true; // unset answer
  }

  return ctx.completeAt ? value < ctx.completeAt : Boolean(value);
};

/**
 * Validate bid completed at timestamp
 * @param  {Number?} value
 * @param  {Object} ctx
 * @return {Boolean}
 */
const isValidCompleteAt = (value, ctx) => {
  if (typeof value !== 'number') {
    return true; // unanswered
  }

  if (value === 0) {
    return true; // unset answer
  }

  return ctx.startAt ? value > ctx.startAt : Boolean(value);
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
    use: { isValidStartAt },
  },
  completeAt: {
    type: Number,
    required: false,
    use: { isValidCompleteAt },
  },
  scope: {
    type: String,
    enum: config.bids.scopeTypes,
    required: true,
  },
  vendorW9: {
    type: Boolean,
    required: false,
  },
  vendorInsurance: {
    type: Boolean,
    required: false,
  },
  vendorLicense: {
    type: Boolean,
    required: false,
  },
});

/**
 * Validate a bid update
 * @param {Object} bid
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = bid => {
  assert(bid && typeof bid, 'has bid instance');
  const clone = JSON.parse(JSON.stringify(bid));
  return bidSchema.validate(clone);
};
