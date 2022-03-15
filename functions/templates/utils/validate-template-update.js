const assert = require('assert');
const Schema = require('validate');
const deepClone = require('../../utils/deep-clone');

const templateSchema = new Schema({
  name: {
    type: String,
    required: false,
    length: { min: 1 },
  },
  description: {
    type: String,
    required: false,
  },
  category: {
    type: String,
    required: false,
  },
  trackDeficientItems: {
    type: Boolean,
    required: false,
  },
  requireDeficientItemNoteAndPhoto: {
    type: Boolean,
    required: false,
  },
  sections: {
    type: Object,
    required: false,
  },
  items: {
    type: Object,
    required: false,
  },
});

const sectionSchema = new Schema({
  title: {
    type: String,
    required: false,
    length: { min: 1 },
  },
  index: {
    type: Number,
    required: false,
  },
  section_type: {
    type: String,
    required: false,
    enum: ['single', 'multi'],
  },
});

const itemSchema = new Schema({
  title: {
    type: String,
    required: false,
    length: { min: 1 },
  },
  index: {
    type: Number,
    required: false,
  },
  itemType: {
    type: String,
    required: false,
    enum: ['main', 'text_input', 'signature'],
  },
  mainInputType: {
    type: String,
    required: false,
  },
  mainInputZeroValue: {
    type: Number,
    required: false,
  },
  mainInputOneValue: {
    type: Number,
    required: false,
  },
  mainInputTwoValue: {
    type: Number,
    required: false,
  },
  mainInputThreeValue: {
    type: Number,
    required: false,
  },
  mainInputFourValue: {
    type: Number,
    required: false,
  },
  notes: {
    type: Boolean,
    required: false,
  },
  photos: {
    type: Boolean,
    required: false,
  },
  sectionId: {
    type: String,
    required: false,
  },
});

/**
 * Validate a template update
 * @param {Object} template
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = template => {
  assert(template && typeof template, 'has template instance');
  const clone = JSON.parse(JSON.stringify(template));
  const result = templateSchema.validate(clone);

  if (template.sections && typeof template.sections === 'object') {
    Object.keys(template.sections)
      .filter(id => Boolean(template.sections[id])) // ignore deletes
      .forEach(id => {
        const sectionClone = deepClone(template.sections[id]);
        const sectionResult = sectionSchema.validate(sectionClone);
        result.push(
          ...sectionResult.map(res => ({
            ...res,
            path: `sections.${id}.${res.path}`, // add full path to validation
          }))
        );
      });
  }

  if (template.items && typeof template.items === 'object') {
    Object.keys(template.items)
      .filter(id => Boolean(template.items[id])) // ignore deletes
      .forEach(id => {
        const itemClone = deepClone(template.items[id]);
        const itemResult = itemSchema.validate(itemClone);
        result.push(
          ...itemResult.map(res => ({
            ...res,
            path: `items.${id}.${res.path}`, // add full path to validation
          }))
        );
      });
  }

  return result;
};
