const pipe = require('lodash/fp/flow');
const log = require('../utils/logger');
const { deficientItems } = require('../config');
const { createDeficientItems } = require('../inspections/utils');

const LOG_PREFIX = 'properties: process-meta:';
const REQUIRED_ACTIONS_VALUES = deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = deficientItems.followUpActionStates;

// Pipeline of steps to update metadata
const propertyMetaUpdates = pipe([
  updateNumOfInspections,
  updateLastInspectionAttrs,
  updateDeficientItemsAttrs
]);

/**
 * Process changes to a property's metadata when it's
 * completed inspections' chanages
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {String} propertyId
 * @return {Promise} - resolves {Object} updates
 */
module.exports = async function processMeta(db, propertyId) {
  try {
    // Find all property's inspections
    const inspectionsSnap = await db.ref('/inspections').orderByChild('property').equalTo(propertyId).once('value');
    const inspectionsData = inspectionsSnap.exists() ? inspectionsSnap.val() : {};
    const inspections = Object.keys(inspectionsData).map(inspId => Object.assign({id: inspId}, inspectionsData[inspId]));

    if (!inspections.length) {
      return {};
    }

    // Find any deficient items data for property
    const propertyInspectionDeficientItemsSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).once('value');
    const propertyInspectionDeficientItemsData = propertyInspectionDeficientItemsSnap.exists() ? propertyInspectionDeficientItemsSnap.val() : {};
    const deficientItems = [].concat(...Object.keys(propertyInspectionDeficientItemsData) // Flatten into single level items
      .map(inspectionId =>
        Object.keys(propertyInspectionDeficientItemsData[inspectionId])
          .map(itemId => Object.assign({id: itemId}, propertyInspectionDeficientItemsData[inspectionId][itemId]))
      ));

    // Collect updates to write to property's metadata attrs
    const { updates } = propertyMetaUpdates({
      propertyId,
      inspections,
      deficientItems,
      updates: Object.create(null)
    });

    // Atomically write each metadata update
    const updatePaths = Object.keys(updates);
    for (let i = 0; i < updatePaths.length; i++) {
      const path = updatePaths[i];
      await db.ref(path).set(updates[path]);
    }

    log.info(`${LOG_PREFIX} successfully updated property ${propertyId} metadata`);
    return updates;
  } catch (e) {
    log.error(`${LOG_PREFIX} failed updating property ${propertyId} metadata ${e}`);
    return null;
  }
}

/**
 * Configure update for all a property's
 * completed inspections
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateNumOfInspections(config = { propertyId: '', inspections: [], updates: {} }) {
  config.updates[`/properties/${config.propertyId}/numOfInspections`] = config.inspections.reduce(
    (acc, { inspectionCompleted }) => {
      if (inspectionCompleted) {
        acc += 1;
      }

      return acc;
  }, 0);

  return config;
}

/**
 * Configure update for a property's
 * latest inspection attributes
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateLastInspectionAttrs(config = { propertyId: '', inspections: [], updates: {} }) {
  const [latestInspection] = config.inspections.sort((a, b) => b.creationDate - a.creationDate); // DESC

  if (latestInspection && latestInspection.inspectionCompleted) {
    config.updates[`/properties/${config.propertyId}/lastInspectionScore`] = latestInspection.score;
    config.updates[`/properties/${config.propertyId}/lastInspectionDate`] = latestInspection.creationDate;
  }

  return config;
}

/**
 * Configure update for a property's
 * inspection's deficient items attrs
 *
 * NOTE: property's deficient items are first calculated from
 * inspections to mitigate race conditions with `/propertyInspectionDeficientItems`,
 * which is also used if available
 *
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object[]} deficientItems
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateDeficientItemsAttrs(config = { propertyId: '', inspections: [], deficientItems: [], updates: {} }) {
  const deficientInspectionItems = config.inspections
    .filter(({ inspectionCompleted, trackDeficientItems, template }) =>
      inspectionCompleted && trackDeficientItems && Boolean(template.items)) // only completed, DI enabled, /w items
    .map(inspection => createDeficientItems(inspection)) // create inspection's deficient items
    .filter(calcDeficientItems => Object.keys(calcDeficientItems).length) // remove  non-deficient inspections
    .map(defItems => {
      // Merge latest state from:
      // `/propertyInspectionDeficientItems/...` into
      // deficient items calculated from inspections
      Object.keys(defItems).forEach(itemId => {
        const [latest] = config.deficientItems.filter(({id}) => id === itemId);
        Object.assign(defItems[itemId], latest || {}); // merge latest state
      });
      return defItems;
    });

  // Count all deficient items
  config.updates[`/properties/${config.propertyId}/numOfDeficientItems`] = deficientInspectionItems.reduce((acc, defItems) =>
    acc + Object.keys(defItems).length
  , 0);

  // Count all deficient items where state requires action
  config.updates[`/properties/${config.propertyId}/numOfRequiredActionsForDeficientItems`] = deficientInspectionItems.reduce((acc, defItems) =>
    acc + Object.keys(defItems).filter(itemId => REQUIRED_ACTIONS_VALUES.includes(defItems[itemId].state)).length
  , 0);

  // Count all deficient items where state requires follow up
  config.updates[`/properties/${config.propertyId}/numOfFollowUpActionsForDeficientItems`] = deficientInspectionItems.reduce((acc, defItems) =>
    acc + Object.keys(defItems).filter(itemId => FOLLOW_UP_ACTION_VALUES.includes(defItems[itemId].state)).length
  , 0);

  return config;
}
