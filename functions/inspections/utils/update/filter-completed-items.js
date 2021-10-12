const assert = require('assert');
const pipe = require('../../../utils/pipe');
const config = require('../../../config');

const DEFICIENT_LIST_ELIGIBLE = config.inspection.DEFICIENT_LIST_ELIGIBLE;

/**
 * Filter items for completed
 * @param  {Object[]} items
 * @param  {Boolean} requireDeficientItemNoteAndPhoto
 * @return {Object[]} - filtered complete items
 */
module.exports = function filterCompletedItems(
  items,
  requireDeficientItemNoteAndPhoto = false
) {
  assert(
    'has array of items',
    Array.isArray(items) && items.every(i => i && typeof i === 'object')
  );

  return pipe(
    concatCompletedMainInputItems,
    concatNaItems,
    concatCompletedTextInputItems,
    concatCompletedSignatureInputItems,
    concatCompletedMainNoteInputItems,
    concatIfYesNoTextInputItems
  )([], items, Boolean(requireDeficientItemNoteAndPhoto)).filter(
    (item, index, all) => all.indexOf(item) === index // unique only
  );
};

/**
 * Add all "if yes" "if no" text items as complete reguardless of content
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @return {Object[]} src
 */
function concatIfYesNoTextInputItems(src, items) {
  return src.concat(
    items.filter(item => {
      const isText = item.isTextInputItem || item.itemType === 'text_input';
      return isText && `${item.title}`.trim().search(/^if (yes|no)/i) === 0;
    })
  );
}

/**
 * Add completed main input items
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @return {Object[]} - src
 */
function concatCompletedMainNoteInputItems(src, items) {
  return src.concat(
    items.filter(item => {
      const type = `${item.mainInputType || ''}`.toLowerCase();
      return type === 'oneaction_notes' && Boolean(item.mainInputNotes);
    })
  );
}

/**
 * Add completed signature input items
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @return {Object[]} - src
 */
function concatCompletedSignatureInputItems(src, items) {
  return src.concat(
    items.filter(
      item =>
        item.itemType === 'signature' && Boolean(item.signatureDownloadURL)
    )
  );
}

/**
 * Add completed text input items
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @return {Object[]} - src
 */
function concatCompletedTextInputItems(src, items) {
  return src.concat(
    items.filter(item => {
      const isText = item.isTextInputItem || item.itemType === 'text_input';
      return isText && Boolean(item.textInputValue);
    })
  );
}

/**
 * Add completed inspection items
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @param  {Boolean} requireDeficientItemNoteAndPhoto
 * @return {Object[]} - src
 */
function concatCompletedMainInputItems(
  src,
  items,
  requireDeficientItemNoteAndPhoto
) {
  return src.concat(
    items.filter(item => {
      const mainInputType = `${item.mainInputType || ''}`.toLowerCase();
      const isMain =
        ['signature', 'text_input'].includes(item.itemType) === false; // ignore signature & text_input
      const isNotNote = mainInputType !== 'oneaction_notes';

      // If items configured to required notes & photos
      // when they are deficient, check for presence
      let hasRequiredDInote = true;
      let hasRequiredDIphoto = true;

      if (
        requireDeficientItemNoteAndPhoto &&
        DEFICIENT_LIST_ELIGIBLE[mainInputType]
      ) {
        const deficientEligibles = DEFICIENT_LIST_ELIGIBLE[mainInputType];
        const isDeficient =
          deficientEligibles[item.mainInputSelection] || false;
        hasRequiredDInote =
          isDeficient && item.notes ? Boolean(item.inspectorNotes) : true;
        hasRequiredDIphoto =
          isDeficient && item.photos ? Boolean(item.photosData) : true;
      }

      return (
        isMain &&
        isNotNote &&
        Boolean(item.mainInputSelected) &&
        typeof item.mainInputSelection === 'number' &&
        hasRequiredDInote &&
        hasRequiredDIphoto
      );
    })
  );
}

/**
 * Add ignored items
 * @param  {Object[]} src
 * @param  {Object[]} items
 * @return {Object[]} - src
 */
function concatNaItems(src, items) {
  return src.concat(items.filter(key => key.isItemNA));
}
