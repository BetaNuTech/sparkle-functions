const assert = require('assert');
const calculateScore = require('./calculate-score');
const filterCompleted = require('./filter-completed-items');
const pipe = require('../../../utils/pipe');
const { hasDiffs } = require('../../../utils/object-differ');

/**
 * Apply all update logic to inspection
 * @param   {Object} inspection - current inspection data
 * @param   {Object} userUpdates - user updates
 * @param   {Number} now - current timestamp
 * @returns {Object} update - user and system updates to an inspection
 */
module.exports = function updateInspection(
  inspection,
  userUpdates,
  now = Math.round(Date.now() / 1000)
) {
  assert(
    inspection && typeof inspection === 'object',
    'has inspection instance'
  );
  assert(
    userUpdates && typeof userUpdates === 'object',
    'has user updates object'
  );
  assert(now && typeof now === 'number', 'has numeric now at timestamp');
  assert(now > 0, 'has viable timestamp');

  const updates = {};
  const current = JSON.parse(JSON.stringify(inspection));
  const changes = JSON.parse(JSON.stringify(userUpdates));

  pipe(
    setUpsertSections,
    setRemovedMultiSections,
    setUpsertItems,
    setRemovedMultiSectionItems, // must go after removed multi sections
    setTotalItems,
    setItemsCompleted,
    setCompleted,
    setCompletionDate,
    setDeficienciesExist,
    setScore,
    setUpdateLastDate,
    setUpdatedAt
  )({ current, changes, now, updates });

  // Move item updates under template
  if (updates.items) {
    updates.template = updates.template || {};
    updates.template.items = JSON.parse(JSON.stringify(updates.items)); // clone
    delete updates.items;
  }

  // Move section updates under template
  if (updates.sections) {
    updates.template = updates.template || {};
    updates.template.sections = JSON.parse(JSON.stringify(updates.sections)); // clone
    delete updates.sections;
  }

  return updates;
};

/**
 * Clone all section changes to updates
 * allowing users to modify existing sections
 * and add new multi-sections to inspection
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpsertSections(config) {
  const { changes, current, updates } = config;
  const template = current.template || {};

  Object.keys(changes.sections || {}).forEach(id => {
    const isSectionUpserted = Boolean(changes.sections[id]);
    if (!isSectionUpserted) return;

    const sectionChanges = JSON.parse(JSON.stringify(changes.sections[id]));
    const sectionCurrent = JSON.parse(
      JSON.stringify((template.sections || {})[id] || {})
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
  });

  return config;
}

/**
 * Remove a delete multi-section
 * by adding a Firstore delete value
 * @param  {Object} config
 * @return {Object} - config
 */
function setRemovedMultiSections(config) {
  const { changes, current, updates } = config;
  const template = current.template || {};

  Object.keys(changes.sections || {}).forEach(id => {
    const currentSection = (template.sections || {})[id] || {};
    const isRemovable = currentSection.section_type === 'multi';
    const isClonedMultiSection = currentSection.added_multi_section === true;
    const isSectionRemoved = changes.sections[id] === null;

    if (isRemovable && isClonedMultiSection && isSectionRemoved) {
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
  const template = current.template || {};

  Object.keys(changes.items || {}).forEach(id => {
    const isItemUpserted = Boolean(changes.items[id]);
    if (!isItemUpserted) return;

    const itemChanges = JSON.parse(JSON.stringify(changes.items[id]));
    const itemCurrent = JSON.parse(
      JSON.stringify((template.items || {})[id] || {})
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
  });

  return config;
}

/**
 * Remove all a deleted multi-section's
 * items associated with it
 * @param  {Object} config
 * @return {Object} - config
 */
function setRemovedMultiSectionItems(config) {
  const { current, updates } = config;
  const template = current.template || {};

  Object.keys(updates.sections || {}).forEach(id => {
    const isRemovingSection = updates.sections[id] === null;

    if (isRemovingSection) {
      // Remove all items of deleted section
      Object.keys(template.items || {})
        .filter(itemId => template.items[itemId].sectionId === id)
        .forEach(itemId => {
          updates.items = updates.items || {};
          updates.items[itemId] = null;
        });
    }
  });

  return config;
}

/**
 * Set total items counter
 * @param  {Object} config
 * @return {Object} - config
 */
function setTotalItems(config) {
  const { current, changes, updates } = config;
  const template = current.template || {};
  const deletedItemIds = filterDeletedItemsIds(updates.items);
  const totalItems = []
    .concat(Object.keys(template.items || {}), Object.keys(changes.items || {}))
    .filter((id, i, arr) => arr.indexOf(id) === i) // filter unique
    .filter(id => !deletedItemIds.includes(id)).length; // filter removed

  if (current.totalItems !== totalItems) {
    updates.totalItems = totalItems;
  }

  return config;
}

/**
 * Set items completed counter
 * @param  {Object} config
 * @return {Object} - config
 */
function setItemsCompleted(config) {
  const { current, changes, updates } = config;
  const template = current.template || {};
  const mergedItems = mergeItems(template.items, changes.items || {});
  const items = hashToArray(mergedItems);
  const deletedItemIds = filterDeletedItemsIds(updates.items);
  const itemsCompleted = filterCompleted(
    items,
    Boolean(template.requireDeficientItemNoteAndPhoto)
  ).filter(({ id }) => !deletedItemIds.includes(id)).length;

  if (current.itemsCompleted !== itemsCompleted) {
    updates.itemsCompleted = itemsCompleted;
  }

  return config;
}

/**
 * Set deficiencies exist
 * @param  {Object} config
 * @return {Object} - config
 */
function setDeficienciesExist(config) {
  const { current, updates } = config;
  const template = current.template || {};
  const mergedItems = mergeItems(template.items, updates.items);
  const items = hashToArray(mergedItems);
  const deletedItemIds = filterDeletedItemsIds(updates.items);
  const deficienciesExist = Boolean(
    items
      .filter(({ id }) => !deletedItemIds.includes(id))
      .filter(i => !i.isItemNA && i.deficient === true).length
  );

  if (current.deficienciesExist !== deficienciesExist) {
    updates.deficienciesExist = deficienciesExist;
  }

  return config;
}

/**
 * Set if inspection completed
 * @param  {Object} config
 * @return {Object} - config
 */
function setCompleted(config) {
  const { current, updates } = config;
  const totalItems =
    typeof updates.totalItems !== 'undefined'
      ? updates.totalItems
      : current.totalItems;
  const itemsCompleted =
    typeof updates.itemsCompleted !== 'undefined'
      ? updates.itemsCompleted
      : current.itemsCompleted;
  const isCurrentlyCompleted = current.inspectionCompleted === true;
  const isCurrentlyIncomplete = current.inspectionCompleted === false;

  if (isCurrentlyCompleted && totalItems > itemsCompleted) {
    updates.inspectionCompleted = false; // allow unsetting completed
  } else if (isCurrentlyIncomplete && itemsCompleted >= totalItems) {
    updates.inspectionCompleted = true;
  }

  return config;
}

/**
 * Set `completionDate` when completed
 * @param  {Object} config
 * @return {Object} - config
 */
function setCompletionDate(config) {
  const { current, updates, now } = config;
  const isCompleted =
    typeof updates.inspectionCompleted !== 'undefined'
      ? updates.inspectionCompleted
      : current.inspectionCompleted;

  if (isCompleted && !current.completionDate) {
    updates.completionDate = now;
  }

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
 * Set inspection score from items
 * @param  {Object} config
 * @return {Object} - config
 */
function setScore(config) {
  const { current, updates } = config;
  const template = current.template || {};
  const mergedItems = mergeItems(template.items, updates.items);
  const items = hashToArray(mergedItems);
  const deletedItemIds = filterDeletedItemsIds(updates.items);
  const finalItems = items.filter(({ id }) => !deletedItemIds.includes(id));
  const isCompleted =
    typeof updates.inspectionCompleted !== 'undefined'
      ? updates.inspectionCompleted
      : current.inspectionCompleted;
  const score = isCompleted ? calculateScore(finalItems) : 0;

  if (isCompleted && score !== current.score) {
    updates.score = score;
  } else if (!isCompleted && current.score !== 0) {
    updates.score = 0;
  }

  return config;
}

/**
 * Set the last update date
 * @param  {Object} config
 * @return {Object} - config
 */
function setUpdateLastDate(config) {
  const { current, updates, now } = config;

  if (
    current.inspectionCompleted === false &&
    updates.inspectionCompleted === true
  ) {
    updates.updatedLastDate = now;
  }

  return config;
}

/**
 * Convert a nested hash into array of records
 * @param  {Object?} hash
 * @return {Object[]} - records
 */
function hashToArray(hash = {}) {
  assert(hash && typeof hash === 'object', 'has hash object');
  return Object.keys(hash || {}).map(key =>
    Object.assign({ id: key }, JSON.parse(JSON.stringify(hash[key])))
  );
}

/**
 * Merge item updates into current state
 * @param  {Object} current
 * @param  {Object} updates
 * @return {Object} - merged
 */
function mergeItems(current = {}, updates = {}) {
  assert(current && typeof current === 'object', 'has current items object');
  assert(updates && typeof updates === 'object', 'has updates items object');

  const merged = {};
  Object.keys(current).forEach(id => {
    merged[id] = merged[id] || {};
    Object.assign(merged[id], JSON.parse(JSON.stringify(current[id])));
  });

  // Merge item updates
  Object.keys(updates).forEach(id => {
    merged[id] = merged[id] || {};
    Object.assign(merged[id], JSON.parse(JSON.stringify(updates[id])));
  });

  return merged;
}

/**
 * Filter all items down to a list
 * of the deleted ID's
 * @param  {Object?} items
 * @return {String[]}
 */
function filterDeletedItemsIds(items) {
  return Object.keys(items || {}).filter(id => items[id] === null);
}
