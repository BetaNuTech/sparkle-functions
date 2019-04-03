const _ = require('lodash');
const assert = require('assert');
const config = require('../../config');

const LOG_PREFIX = 'inspections: utils: create-deficient-items';
const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;
const DEFAULT_DEFICIENT_ITEM = Object.freeze({
  state: 'requires-action',
  startTimestamps: null,
  currentStartTimestamp: 0,
  dueDates: null,
  currentDueDate: 0,
  deficientTimestamp: 0,
  plansToFix: null,
  currentPlanToFix: '',
  responsibilityGroups: null,
  currentResponsibilityGroup: '',
  progressNotes: null,
  reasonsIncomplete: null,
  currentReasonIncomplete: '',
  completedPhotos: null,
  itemAdminEdits: null,
  itemInspectorNotes: '',
  itemTitle: '',
  itemMainInputType: '',
  itemMainInputSelection: 0,
  itemPhotosData: null
});

/**
 * Factory for an inspections deficient items
 * @param  {Object} inspection
 * @return {Object} - deficient items
 */
module.exports = function createDeficientItems(inspection = { template: {} }) {
  assert(inspection && typeof inspection === 'object', `${LOG_PREFIX} has inspection`);
  assert(Boolean(inspection.id), 'has inspection id');
  assert(inspection.inspectionCompleted, `${LOG_PREFIX} has completed inspection`);
  assert(inspection.trackDeficientItems, `${LOG_PREFIX} has deficient items list enabled`);
  assert(Boolean(inspection.template), `${LOG_PREFIX} has inspection template`);
  assert(Boolean(inspection.template.items), `${LOG_PREFIX} has inspection template items`);

  const result = Object.create(null);

  // Create list of all inspection's template items
  const items = Object.keys(inspection.template.items).map(
    itemId => Object.assign({ id: itemId }, inspection.template.items[itemId])
  );

  // Collect all deficient items
  const deficientItems = items.filter(item => {
    const deficientsForType = DEFICIENT_ITEM_ELIGIBLE[(item.mainInputType || '').toLowerCase()];

    if(!deficientsForType) {
      return false;
    }

    return deficientsForType[item.mainInputSelection] || false;
  });

  // Configure result w/ default deficient items
  deficientItems.forEach(item => {
    const section = inspection.template.sections ? inspection.template.sections[item.sectionId] || {} : {};
    const sectionType = section.section_type || 'single';

    // Add multi section sub title if present
    let sectionSubtitle = undefined;
    if (sectionType === 'multi') {
      const [firstItem] = getSectionItems(item.sectionId, inspection);
      if (firstItem.itemType === 'text_input' && firstItem.title) sectionSubtitle = firstItem.title;
    }

    // Use latest admin edit or inspection's last update date
    const itemDataLastUpdatedTimestamp = getLatestItemAdminEditTimestamp(item) || inspection.updatedLastDate;

    result[item.id] = Object.assign(
      {},
      DEFAULT_DEFICIENT_ITEM,
      {
        itemData: _.omit(item, 'id'),
        sectionTitle: section.title || undefined,
        itemTitle: item.title,
        itemDataLastUpdatedTimestamp,
        sectionSubtitle,
        sectionType
      }
    );

    // Cleanup falsey values for item
    Object.keys(result[item.id]).forEach(attr => {
      if (!result[item.id][attr]) delete result[item.id][attr];
    });
  });

  return result;
};

/**
 * Collect all items for a section sorted
 * by their index
 * @param  {String} sectionId
 * @param  {Object} inspection
 * @return {Object[]} - section's items
 */
function getSectionItems(sectionId, inspection) {
  assert(sectionId && typeof sectionId === 'string', 'has section ID');
  assert(inspection && inspection.template && inspection.template.items, 'has inspection template with items');

  return Object.keys(inspection.template.items)
    .map(itemId => Object.assign({}, inspection.template.items[itemId])) // Item hash to array
    .filter(item => item.sectionId === sectionId) // only section items
    .sort((a, b) => a.index - b.index); // sort ascending
}

/**
 * Find latest admin edit of an item
 * @param  {Object} item
 * @return {Number} - admin edit timestamp or `0`
 */
function getLatestItemAdminEditTimestamp({ adminEdits }) {
  const [result] = Object.keys(adminEdits || {})
    .map(adminEditId => adminEdits[adminEditId]) // Create admin edit array
    .sort((a, b) => b.edit_date - a.edit_date); // Descending
  return result ? result.edit_date : 0;
}
