const assert = require('assert');
const Schema = require('validate');

const propertySchema = new Schema({
  id: {
    type: String,
  },
  name: {
    type: String,
  },
  addr1: {
    type: String,
  },
  addr2: {
    type: String,
  },
  city: {
    type: String,
  },
  code: {
    type: String,
  },
  lastInspectionDate: {
    type: Number,
  },
  lastInspectionScore: {
    type: Number,
  },
  loan_type: {
    type: String,
  },
  maint_super_name: {
    type: String,
  },
  manager_name: {
    type: String,
  },
  num_of_units: {
    type: Number,
  },
  numOfInspections: {
    type: Number,
  },
  bannerPhotoName: {
    type: String,
  },
  bannerPhotoURL: {
    type: String,
  },
  logoName: {
    type: String,
  },
  logoURL: {
    type: String,
  },
  photoName: {
    type: String,
  },
  photoURL: {
    type: String,
  },
  state: {
    type: String,
  },
  year_built: {
    type: Number,
  },
  slackChannel: {
    type: String,
  },
  zip: {
    type: String,
  },
  templates: {
    type: Object,
  },
  team: {
    type: String,
  },
  numOfDeficientItems: {
    type: Number,
  },
  numOfRequiredActionsForDeficientItems: {
    type: Number,
  },
  numOfFollowUpActionsForDeficientItems: {
    type: Number,
  },
});

/**
 * Validate a def
 * @param {Object} propertyUpdate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = propertyUpdate => {
  assert(propertyUpdate && typeof propertyUpdate, 'has property update');
  const clone = JSON.parse(JSON.stringify(propertyUpdate));
  return propertySchema.validate(clone);
};
