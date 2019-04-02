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
  completedPhotos: null
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
    let sectionSubtitle = '';
    if (sectionType === 'multi') {
      const [firstItem] = getSectionItems(item.sectionId, inspection);
      if (firstItem.itemType === 'text_input' && firstItem.title) sectionSubtitle = firstItem.title;
    }

    result[item.id] = Object.assign(
      {},
      DEFAULT_DEFICIENT_ITEM,
      {
        itemDataLastUpdatedTimestamp: inspection.updatedLastDate,
        itemData: _.omit(item, 'id'),
        sectionTitle: section.title || '',
        sectionSubtitle,
        sectionType
      }
    );
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
