const assert = require('assert');
const Schema = require('validate');

const propertySchema = new Schema({
  id: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  addr1: {
    type: String,
    required: false,
  },
  addr2: {
    type: String,
    required: false,
  },
  city: {
    type: String,
    required: false,
  },
  code: {
    type: String,
    required: false,
  },
  lastInspectionDate: {
    type: Number,
    required: false,
  },
  lastInspectionScore: {
    type: Number,
    required: false,
  },
  loan_type: {
    type: String,
    required: false,
  },
  maint_super_name: {
    type: String,
    required: false,
  },
  manager_name: {
    type: String,
    required: false,
  },
  num_of_units: {
    type: Number,
    required: false,
  },
  numOfInspections: {
    type: Number,
    required: false,
  },
  bannerPhotoName: {
    type: String,
    required: false,
  },
  bannerPhotoURL: {
    type: String,
    required: false,
  },
  logoName: {
    type: String,
    required: false,
  },
  logoURL: {
    type: String,
    required: false,
  },
  photoName: {
    type: String,
    required: false,
  },
  photoURL: {
    type: String,
    required: false,
  },
  state: {
    type: String,
    required: false,
  },
  year_built: {
    type: Number,
    required: false,
  },
  slackChannel: {
    type: String,
    required: false,
  },
  zip: {
    type: String,
    required: false,
  },
  templates: {
    type: Object,
  },
  team: {
    type: String,
    required: false,
  },
  numOfDeficientItems: {
    type: Number,
    required: false,
  },
  numOfRequiredActionsForDeficientItems: {
    type: Number,
    required: false,
  },
  numOfFollowUpActionsForDeficientItems: {
    type: Number,
    required: false,
  },
});

/**
 * Validate a def
 * @param {Object} propertyCreate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = propertyCreate => {
  assert(propertyCreate && typeof propertyCreate, 'has property create');
  const clone = JSON.parse(JSON.stringify(propertyCreate));
  return propertySchema.validate(clone);
};
