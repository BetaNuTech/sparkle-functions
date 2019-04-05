const assert = require('assert');
const config = require('../../config');
const getLatestItemAdminEditTimestamp = require('./get-latest-admin-edit-timestamp');

const LOG_PREFIX = 'inspections: utils: create-deficient-items';
const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;
const DEFAULT_DEFICIENT_ITEM = Object.freeze({
  createdAt: 0,
  updatedAt: 0,
  startDates: null,
  currentStartDate: 0,
  stateHistory: null,
  state: 'requires-action',
  dueDates: null,
  currentDueDate: 0,
  plansToFix: null,
  currentPlanToFix: '',
  responsibilityGroups: null,
  currentResponsibilityGroup: '',
  progressNotes: null,
  reasonsIncomplete: null,
  currentReasonIncomplete: '',
  completedPhotos: null,
  itemDataLastUpdatedDate: 0,
  sectionTitle: '',
  sectionSubtitle: '',
  sectionType: '',
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
      if (firstItem.itemType === 'text_input' && firstItem.textInputValue) sectionSubtitle = firstItem.textInputValue;
    }

    // Use latest admin edit or inspection's last update date
    const itemDataLastUpdatedDate = getLatestItemAdminEditTimestamp(item) || inspection.updatedLastDate;

    result[item.id] = Object.assign(
      {},
      DEFAULT_DEFICIENT_ITEM,
      {
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
        itemMainInputType: item.mainInputType,
        sectionTitle: section.title || undefined,
        itemTitle: item.title,
        itemInspectorNotes: item.inspectorNotes,
        itemAdminEdits: item.adminEdits ? deepClone(item.adminEdits) : null,
        itemPhotosData: item.photosData ? deepClone(item.photosData) : null,
        itemMainInputSelection: item.mainInputSelection,
        itemDataLastUpdatedDate,
        sectionSubtitle,
        sectionType,
      }
    );

    // Cleanup falsey values for item, except
    // "itemMainInputSelection" which may be 0
    Object.keys(result[item.id]).forEach(attr => {
      if (!result[item.id][attr] && attr !== 'itemMainInputSelection') {
        delete result[item.id][attr];
      }
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
 * Clone an object
 * @param  {Object} obj
 * @return {Object} - cloned
 */
function deepClone(obj = {}) {
  return JSON.parse(JSON.stringify(obj));
}
