const assert = require('assert');
const pipe = require('../../../utils/pipe');
const config = require('../../../config');

const scoreNames = config.inspection.SCORE_NAMES;

/**
 * Reduce completed items to an inspection score
 * @param  {Object[]} items
 * @return {Number} - score
 */
module.exports = function calculateScore(items) {
  assert(items && typeof items === 'object', 'has items array');

  const activeItems = items.filter(item => !item.isItemNA);
  const earned = pipe(
    itemsToScores,
    textItemsToScores,
    signatureItemsToZero,
    reduceSumsToTotal
  )(activeItems);
  const total = pipe(
    itemsToMaxScores,
    textItemsToMaxScores,
    signatureItemsToZero,
    reduceSumsToTotal
  )(activeItems);
  const result = earned / total;

  // Inspection has nothing to earn
  if (total === 0) {
    return 100;
  }

  // Fallback for NaN result
  if (result !== result) {
    return 0;
  }

  return result * 100; // default case
};

/**
 * Get the maximum score of an item
 * @param  {Object[]} items
 * @return {Number|Object[]} - scores
 */
function itemsToMaxScores(items) {
  return items.map(item => {
    // Ignore text & signature input
    if (
      item.isTextInputItem ||
      item.itemType === 'text_input' ||
      item.itemType === 'signature'
    ) {
      return item;
    }

    /**
     * All item's scores
     * @type {Number[]}
     */
    const itemScores = scoreNames.map(name => item[name] || 0);
    return Math.max(...itemScores);
  });
}

/**
 * Get max text item scores
 * @param  {Number|Object[]} items
 * @return {Number[]}
 */
function textItemsToMaxScores(items) {
  return items.map(item => {
    if (typeof item === 'object' && item.isTextInputItem) {
      // NOTE: text item score 3 removed | 0 max score for "if yes/no" items
      return `${item.title || ''}`.trim().search(/^if (yes|no)/i) === 0 ? 0 : 0;
    }

    return item;
  });
}

/**
 * Convert signature items to 0 scores
 * @param  {Number|Object[]} items
 * @return {Number[]}
 */
function signatureItemsToZero(items) {
  return items.map(item => {
    if (typeof item === 'object' && item.itemType === 'signature') {
      return 0;
    }
    return item;
  });
}

/**
 * Get the active score of an item
 * @param  {Object[]} items
 * @return {Number|Object[]} - scores
 */
function itemsToScores(items) {
  return items.map(item => {
    const selection = item.mainInputSelection;

    // Ignore text & signature input
    if (
      item.isTextInputItem ||
      item.itemType === 'text_input' ||
      item.itemType === 'signature'
    ) {
      return item;
    }

    /**
     * Selected score name
     * @type {String}
     */
    const scoreName = scoreNames[selection];
    return scoreName ? item[scoreName] || 0 : 0;
  });
}

/**
 * Get the active score of a text item
 * @param  {Number|Object[]} items
 * @return {Number[]} - scores
 */
function textItemsToScores(items) {
  return items.map(item => {
    if (typeof item === 'object' && item.isTextInputItem) {
      return Boolean(item.textInputValue) &&
        `${item.title || ''}`.trim().search(/^if (yes|no)/i) !== 0
        ? 0 // NOTE: text item score 3 removed
        : 0; // NOTE: 0 score for "if yes/no" items
    }
    return item;
  });
}

/**
 * Reduce sums to a single total
 * @param  {Number[]} sums
 * @return {Number} - total
 */
function reduceSumsToTotal(sums) {
  assert(
    'has sums number array',
    sums.every(sum => typeof sum === 'number')
  );
  return sums.reduce((score, total) => score + total, 0);
}
