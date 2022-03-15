const assert = require('assert');
const pipe = require('../../utils/pipe');
const { hasDiffs } = require('../../utils/object-differ');
const deepClone = require('../../utils/deep-clone');

const ITEM_DEFAULTS = Object.freeze({
  isItemNA: false,
  isTextInputItem: false,
  mainInputSelected: false, // NOTE: matches iOS client
  adminEdits: {},
  photosData: {},
  textInputValue: '', // NOTE: matches iOS client
  signatureDownloadURL: '', // NOTE: matches iOS client
  signatureTimestampKey: '', // NOTE: matches iOS client
});
const MAIN_ITEM_DEFAULTS = Object.freeze({
  mainInputSelection: -1,
});
const TEXT_INPUT_ITEM_DEFAULTS = Object.freeze({
  isTextInputItem: true,
});
const SIGNATURE_ITEM_DEFAULTS = Object.freeze({});
const SECTION_DEFAULTS = Object.freeze({ added_multi_section: false });

/**
 * Apply all update logic to template
 * @param   {Object} template - current data
 * @param   {Object} userUpdates - user updates
 * @param   {Number} now - current timestamp
 * @returns {Object} update - user and system updates to an template
 */
module.exports = function updateTemplate(
  template,
  userUpdates,
  now = Math.round(Date.now() / 1000)
) {
  assert(template && typeof template === 'object', 'has template instance');
  assert(
    userUpdates && typeof userUpdates === 'object',
    'has user updates object'
  );
  assert(now && typeof now === 'number', 'has numeric now at timestamp');
  assert(now > 0, 'has viable timestamp');

  const updates = {};
  const current = JSON.parse(JSON.stringify(template));
  const changes = JSON.parse(JSON.stringify(userUpdates));

  pipe(
    setTemplateUpdates,
    setUpsertSections,
    setRemovedSections,
    setUpsertItems,
    setTransitionedTypeItems, // must go after upsert
    setUpdatedItemVersions, // must go after upsert
    setRemovedItems,
    setRemovedSectionItems, // must go after set removed sections
    setUpdatedAt,
    setCompetedAt
  )({ current, changes, now, updates });

  return updates;
};

/**
 * Apply all top level template updates
 * @param  {Object} config
 * @return {Object} - config
 */
function setTemplateUpdates(config) {
  const { changes, updates } = config;

  Object.keys(changes)
    .filter(key => key !== 'sections' && key !== 'items')
    .forEach(key => {
      updates[key] = changes[key];
    });

  return config;
}

/**
 * Clone all section changes to updates
 * allowing users to modify existing sections
 * and add new sections
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpsertSections(config) {
  const { changes, current, updates } = config;

  Object.keys(changes.sections || {}).forEach(id => {
    const isSectionRemoved = Boolean(changes.sections[id]) === false;
    if (isSectionRemoved) return;

    const isNew = Boolean((current.sections || {})[id]) === false;
    const sectionChanges = JSON.parse(JSON.stringify(changes.sections[id]));
    const sectionCurrent = JSON.parse(
      JSON.stringify((current.sections || {})[id] || {})
    );
    const isDifferent = hasDiffs(
      sectionCurrent,
      sectionChanges,
      Object.keys(sectionChanges)
    );

    if (isDifferent) {
      updates.sections = updates.sections || {};
      updates.sections[id] = sectionChanges;
    }

    // Add default attributes to new section
    if (updates.sections && updates.sections[id] && isNew) {
      Object.assign(updates.sections[id], SECTION_DEFAULTS); // Add required attributes
    }
  });

  return config;
}

/**
 * Remove a deleted section
 * @param  {Object} config
 * @return {Object} - config
 */
function setRemovedSections(config) {
  const { changes, current, updates } = config;

  Object.keys(changes.sections || {}).forEach(id => {
    const hasCurrentSection =
      Object.keys((current.sections || {})[id] || {}).length > 0;
    const isSectionRemoved = changes.sections[id] === null;

    if (hasCurrentSection && isSectionRemoved) {
      updates.sections = updates.sections || {};
      updates.sections[id] = null;
    }
  });

  return config;
}

/**
 * Clone all item changes to updates
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpsertItems(config) {
  const { current, changes, updates } = config;

  Object.keys(changes.items || {})
    .filter(id => Boolean(changes.items[id])) // Filter out removals
    .forEach(id => {
      const isNew = Boolean((current.items || {})[id]) === false;
      const itemChanges = JSON.parse(JSON.stringify(changes.items[id]));
      const itemCurrent = JSON.parse(
        JSON.stringify((current.items || {})[id] || {})
      );
      const isDifferent = hasDiffs(
        itemCurrent,
        itemChanges,
        Object.keys(itemChanges)
      );

      if (isDifferent) {
        updates.items = updates.items || {};
        updates.items[id] = itemChanges;
      }

      const requiresNewDefaults = Boolean(
        isNew && updates.items && updates.items[id]
      );
      const itemType = `${itemChanges.itemType || ''}`.toLowerCase();

      // Add default attributes to new item
      if (requiresNewDefaults) {
        Object.assign(updates.items[id], ITEM_DEFAULTS); // Add required attributes
      }

      if (requiresNewDefaults && itemType === 'main') {
        Object.assign(updates.items[id], MAIN_ITEM_DEFAULTS); // Add required main attributes
      }

      if (requiresNewDefaults && itemType === 'text_input') {
        Object.assign(updates.items[id], TEXT_INPUT_ITEM_DEFAULTS); // Add required text attributes
      }

      if (requiresNewDefaults && itemType === 'signature') {
        Object.assign(updates.items[id], SIGNATURE_ITEM_DEFAULTS); // Add required signature attributes
      }
    });

  return config;
}

/**
 * Transition items that changed
 * type to valid inspection items
 * @param  {Object} config
 * @return {Object} - config
 */
function setTransitionedTypeItems(config) {
  const { current, changes, updates } = config;

  Object.keys(changes.items || {})
    .filter(id => Boolean(changes.items[id])) // Filter out removals
    .filter(id => Boolean(changes.items[id].itemType)) // has type change
    .filter(id => Boolean(updates.items && updates.items[id])) // sanity check
    .forEach(id => {
      const itemChanges = JSON.parse(JSON.stringify(changes.items[id]));
      const itemCurrent = JSON.parse(
        JSON.stringify((current.items || {})[id] || {})
      );
      const changedType = `${itemChanges.itemType}`.toLowerCase();
      const currentType = `${itemCurrent.itemType || ''}`.toLowerCase();
      const isDifferent = changedType !== currentType;

      if (isDifferent) {
        Object.assign(updates.items[id], ITEM_DEFAULTS); // Re-add required attributes
      }

      if (isDifferent && changedType === 'main') {
        Object.assign(updates.items[id], MAIN_ITEM_DEFAULTS);
      }

      if (isDifferent && changedType === 'text_input') {
        Object.assign(updates.items[id], TEXT_INPUT_ITEM_DEFAULTS);
      }

      if (isDifferent && changedType === 'signature') {
        Object.assign(updates.items[id], SIGNATURE_ITEM_DEFAULTS);
      }
    });

  return config;
}

/**
 * Transition items that changed
 * type to valid inspection items
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpdatedItemVersions(config) {
  const { current, updates } = config;

  Object.keys(updates.items || {}).forEach(id => {
    const currentItem = (current.items || {})[id] || {};

    // Increment version
    if (typeof currentItem.version === 'number') {
      updates.items[id].version = currentItem.version + 1;
    } else {
      updates.items[id].version = 0;
    }
  });

  return config;
}

/**
 * Remove all deleted items
 * @param  {Object} config
 * @return {Object} - config
 */
function setRemovedItems(config) {
  const { current, changes, updates } = config;

  Object.keys(changes.items || {})
    .filter(id => changes.items[id] === null) // filter removed
    .filter(id => Boolean(current.items && current.items[id])) // filter existing
    .forEach(id => {
      updates.items = updates.items || {};
      updates.items[id] = null;
    });

  return config;
}

/**
 * Remove all a items associated
 * with a deleted section
 * @param  {Object} config
 * @return {Object} - config
 */
function setRemovedSectionItems(config) {
  const { current, updates } = config;

  Object.keys(updates.sections || {}).forEach(id => {
    const isRemovingSection = updates.sections[id] === null;

    if (isRemovingSection) {
      // Remove all items of deleted section
      Object.keys(current.items || {})
        .filter(itemId => current.items[itemId].sectionId === id)
        .forEach(itemId => {
          updates.items = updates.items || {};
          updates.items[itemId] = null;
        });
    }
  });

  return config;
}

/**
 * set updated at
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpdatedAt(config) {
  const { updates, now } = config;
  const hasUpdates = Boolean(Object.keys(updates).length);

  if (hasUpdates) {
    updates.updatedAt = now;
  }

  return config;
}

/**
 * set completed at once
 * template has enough
 * sections and items to be
 * considered complete
 * @param  {Object} config
 * @return {Object} - config
 */
function setCompetedAt(config) {
  const { current, updates, now } = config;
  const isCompleted = Boolean(current.completedAt);
  const mergedSections = mergeUndeleted(current.sections, updates.sections);
  const hasSections = Object.keys(mergedSections).length > 0;
  const mergedItems = mergeUndeleted(current.items, updates.items);
  const hasItems = Object.keys(mergedItems).length > 0;

  // Already completed
  if (isCompleted) {
    return config;
  }

  // Complete when merged updates
  // into current will complete template
  if (hasSections && hasItems) {
    updates.completedAt = now;
  }

  return config;
}

/**
 * Merge updated into a cloned current
 * removing all values denoting deletion
 * @param  {Object} current
 * @param  {Object} updated
 * @return {Object} clone
 */
function mergeUndeleted(current, updates) {
  const result = deepClone(current || {});

  Object.keys(updates || {}).forEach(id => {
    const isRemoval = Boolean(updates[id]) === false;

    if (isRemoval) {
      delete result[id];
    } else {
      result[id] = result[id] || {};
      Object.assign(result[id], updates[id]);
    }
  });

  return result;
}
