const { deficientItems } = require('../../config');
const createDeficientItems = require('../../deficient-items/utils/create-deficient-items');

const REQUIRED_ACTIONS_VALUES = deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = deficientItems.followUpActionStates;
const EXCLUDED_DI_COUNTER_VALUES =
  deficientItems.excludedPropertyNumOfDeficientItemsStates;

/**
 * Configure update for a property's
 * inspection's deficient items attrs
 *
 * NOTE: property's deficient items are first calculated from
 * inspections to mitigate race conditions with `/propertyInspectionDeficientItems`,
 * which is also used if available
 *
 * @param  {Object[]} inspections
 * @param  {Object[]} deficientItems
 * @param  {Object} updates
 * @return {Object} - configuration
 */
module.exports = function updateDeficientItemsAttrs(
  config = {
    inspections: [],
    deficientItems: [],
    updates: {},
  }
) {
  const deficientItemsLatest = [].concat(
    ...config.inspections // flatten
      .filter(hasDiTracking) // only completed, DI enabled, /w items
      .map(inspection => createDeficientItems(inspection)) // create inspection's deficient items
      .filter(calcDefItems => hasActiveDeficientItems(calcDefItems)) // remove non-deficient inspections
      .map(calcDefItems =>
        mergeExistingDiState(calcDefItems, config.deficientItems)
      )
      .map(hashToMatrix)
  );

  // Count all deficient items
  config.updates.numOfDeficientItems = deficientItemsLatest.filter(
    ({ state }) => !EXCLUDED_DI_COUNTER_VALUES.includes(state)
  ).length;

  // Count all deficient items where state requires action
  config.updates.numOfRequiredActionsForDeficientItems = deficientItemsLatest.filter(
    ({ state }) => REQUIRED_ACTIONS_VALUES.includes(state)
  ).length;

  // Count all deficient items where state requires follow up
  config.updates.numOfFollowUpActionsForDeficientItems = deficientItemsLatest.filter(
    ({ state }) => FOLLOW_UP_ACTION_VALUES.includes(state)
  ).length;

  return config;
};

/**
 * If inspection configured DI tracking
 * @param  {Boolean} inspectionCompleted
 * @param  {Object} template
 * @return {Boolean}
 */
function hasDiTracking({ inspectionCompleted, template }) {
  return (
    inspectionCompleted &&
    Boolean(template) &&
    Boolean(template.trackDeficientItems) &&
    Boolean(template.items)
  );
}

/**
 * Has any calculated deficient items
 * @param  {Object} calcDefItems
 * @return {Boolean}
 */
function hasActiveDeficientItems(calcDefItems) {
  return Boolean(Object.keys(calcDefItems).length);
}

/**
 * Merge any existing state into a
 * created (fresh) DI state
 * @param  {Object[]} createdDefItems
 * @param  {Object[]} existingDefItems
 * @return {Object} - defItems
 */
function mergeExistingDiState(createdDefItems, existingDefItems) {
  Object.keys(createdDefItems).forEach(id => {
    const itemId = createdDefItems[id].item;
    const inspId = createdDefItems[id].inspection;
    const [existingDefItem] = existingDefItems.filter(
      ({ item, inspection }) => item === itemId && inspection === inspId
    );
    Object.assign(createdDefItems[id], existingDefItem || {}); // merge existingDefItem state
  });

  return createdDefItems;
}

/**
 * Convert a flat hash to a matrix
 * of grouped arrays
 * @param  {Object} hash
 * @return {Object[][]}
 */
function hashToMatrix(hash) {
  const matrix = [];
  Object.keys(hash).forEach(hashId => matrix.push(hash[hashId]));
  return matrix;
}
