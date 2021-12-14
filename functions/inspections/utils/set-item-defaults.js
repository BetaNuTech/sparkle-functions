const assert = require('assert');
const pipe = require('../../utils/pipe');

/**
 * Apply all update logic to inspection
 * @param   {Object} inspectionItem - current inspection item
 * @returns {Object} - updates to item
 */
module.exports = function setItemDefaults(inspectionItem) {
  assert(
    inspectionItem && typeof inspectionItem === 'object',
    'has inspection item instance'
  );

  const updates = {};
  const currentItem = JSON.parse(JSON.stringify(inspectionItem));

  return pipe(
    setMainInputType,
    setTextInputSelected,
    setMainInputSelection
  )(updates, { currentItem });
};

/**
 * Set the main input type for
 * main input types that are missing it
 * @param {Object} updates
 * @param {Object} options.currentItem
 * @return {Object} - updates
 */
function setMainInputType(updates, { currentItem }) {
  const isTextInputItem = currentItem.isTextInputItem;
  const isTextInput = currentItem.itemType === 'text_input';
  const isSignatureItem = currentItem.itemType === 'signature';
  const isMainInputEligible =
    !isTextInputItem && !isTextInput && !isSignatureItem;

  if (isMainInputEligible && !currentItem.mainInputType) {
    updates.mainInputType = 'TwoActions_thumbs';
  }

  return updates;
}

/**
 * Set the text input selected
 * to false always
 * @param {Object} updates
 * @param {Object} options.currentItem
 * @return {Object} - updates
 */
function setTextInputSelected(updates, { currentItem }) {
  const isTextInputItem = currentItem.isTextInputItem;
  const isTextInput = currentItem.itemType === 'text_input';

  if (isTextInputItem && isTextInput && currentItem.mainInputSelected) {
    updates.mainInputSelected = false;
  }

  return updates;
}

/**
 * Set main input selection
 * to a negative number to signify
 * that the item is not selected
 * @param {Object} updates
 * @param {Object} options.currentItem
 * @return {Object} - updates
 */
function setMainInputSelection(updates, { currentItem }) {
  const mainInputType = (
    currentItem.mainInputType ||
    updates.mainInputType ||
    ''
  ).toLowerCase();
  const hasSelection = typeof currentItem.mainInputSelection === 'number';
  const isOneActionNote = currentItem.mainInputSelection === 'oneaction_notes';

  if (mainInputType && !isOneActionNote && !hasSelection) {
    updates.mainInputSelection = -1;
  }

  return updates;
}
