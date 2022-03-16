const assert = require('assert');
const Schema = require('validate');
const config = require('../../config/inspection');
const deepClone = require('../../utils/deep-clone');

const ITEM_TYPES = config.itemTypes;
const SECTION_TYPES = config.sectionTypes;
const MAIN_ITEM_TYPES = config.mainItemTypes;

const newSectionSchema = new Schema({
  title: {
    type: String,
    required: true,
    length: { min: 1 },
  },
  index: {
    type: Number,
    required: true,
  },
  section_type: {
    type: String,
    required: true,
    enum: SECTION_TYPES,
  },
});

const newItemSchema = new Schema({
  title: {
    type: String,
    required: true,
    length: { min: 1 },
  },
  index: {
    type: Number,
    required: true,
  },
  itemType: {
    type: String,
    required: true,
    enum: ITEM_TYPES,
  },
  sectionId: {
    type: String,
    required: true,
  },
  mainInputZeroValue: {
    type: Number,
    required: true,
  },
  mainInputOneValue: {
    type: Number,
    required: true,
  },
  mainInputTwoValue: {
    type: Number,
    required: true,
  },
  mainInputThreeValue: {
    type: Number,
    required: true,
  },
  mainInputFourValue: {
    type: Number,
    required: true,
  },
});

const newMainItemSchema = new Schema({
  mainInputType: {
    type: String,
    required: true,
    use: { isMainItemType },
  },
  notes: {
    type: Boolean,
    required: true,
  },
  photos: {
    type: Boolean,
    required: true,
  },
});

/**
 * Validate a template update's
 * new section and item entries
 * @param {Object} srcCurrent - current template
 * @param {Object} srcUpdates - user updates
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = (srcCurrent, srcUpdates) => {
  assert(srcCurrent && typeof srcCurrent, 'has current template instance');
  assert(srcUpdates && typeof srcUpdates, 'has updates object');
  const current = deepClone(srcCurrent);
  const updates = deepClone(srcUpdates);
  const currentItems = current.items || {};
  const currentSections = current.sections || {};
  const result = [];

  if (updates.sections && typeof updates.sections === 'object') {
    Object.keys(updates.sections)
      .filter(id => Boolean(updates.sections[id])) // ignore deletes
      .filter(id => Boolean(currentSections[id]) === false) // ignore updates to existing
      .forEach(id => {
        const sectionClone = deepClone(updates.sections[id]);
        const sectionResult = newSectionSchema.validate(sectionClone);
        result.push(
          ...sectionResult.map(res => ({
            ...res,
            path: `sections.${id}.${res.path}`, // add full path to validation
          }))
        );
      });
  }

  if (updates.items && typeof updates.items === 'object') {
    Object.keys(updates.items)
      .filter(id => Boolean(updates.items[id])) // ignore deletes
      .filter(id => Boolean(currentItems[id]) === false) // ignore updates to existing
      .forEach(id => {
        const itemClone = deepClone(updates.items[id]);
        const itemResult = newItemSchema.validate(itemClone);

        // General item validation
        result.push(
          ...itemResult.map(res => ({
            ...res,
            path: `items.${id}.${res.path}`, // add full path to validation
          }))
        );

        // Main item validation
        if (itemClone.itemType === 'main') {
          const mainItemClone = deepClone(updates.items[id]);
          const mainItemResult = newMainItemSchema.validate(mainItemClone);
          result.push(
            ...mainItemResult.map(res => ({
              ...res,
              path: `items.${id}.${res.path}`, // add full path to validation
            }))
          );
        }
      });
  }

  return result;
};

/**
 * Validate main input item's
 * main type is an acceptable enum
 * case insensitively
 * @param  {String} value
 * @return {Boolean}
 */
function isMainItemType(value) {
  const mainType = `${value || ''}`.toLowerCase();
  return MAIN_ITEM_TYPES.includes(mainType);
}
