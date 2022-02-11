const assert = require('assert');
const Schema = require('validate');
const config = require('../../config');

const deficiencySchema = new Schema({
  currentStartDate: {
    type: Number,
  },
  currentDueDate: {
    type: Number,
  },
  currentDueDateDay: {
    type: String,
  },
  state: {
    type: String,
    enum: config.deficientItems.allStates,
  },
  currentPlanToFix: {
    type: String,
  },
  currentResponsibilityGroup: {
    type: String,
    enum: Object.keys(config.deficientItems.responsibilityGroups),
  },
  progressNote: {
    type: String,
  },
  currentDeferredDate: {
    type: Number,
  },
  currentReasonIncomplete: {
    type: String,
  },
  currentDeferredDateDay: {
    type: String,
  },
  currentCompleteNowReason: {
    type: String,
  },
  isDuplicate: {
    type: Boolean,
  },
  willRequireProgressNote: {
    type: Boolean,
  },
  completedPhotos: {
    type: Object,
  },
});

/**
 * Validate a def
 * @param {Object} update
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = update => {
  assert(update && typeof update, 'has deficiency update');
  const clone = JSON.parse(JSON.stringify(update));
  return deficiencySchema.validate(clone);
};
