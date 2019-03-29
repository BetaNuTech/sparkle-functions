const pipe = require('lodash/fp/flow');
const log = require('../utils/logger');
const { createDeficientItems } = require('../inspections/utils');

const LOG_PREFIX = 'properties: process-meta:';

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
    // Pull all property's inspections
    const inspectionsSnapshot = await db.ref('/inspections').orderByChild('property').equalTo(propertyId).once('value');
    const inspectionsData = inspectionsSnapshot.exists() ? inspectionsSnapshot.val() : {};
    const inspections = Object.keys(inspectionsData).map(inspId => Object.assign({id: inspId}, inspectionsData[inspId]));

    if (!inspections.length) {
      return {};
    }

    // Collect updates to write to propety's metadata attrs
    const { updates } = propertyMetaUpdates({
      propertyId,
      inspections,
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
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateDeficientItemsAttrs(config = { propertyId: '', inspections: [], updates: {} }) {
  const deficientInspections = config.inspections
    .filter(({ inspectionCompleted, template }) => inspectionCompleted && Boolean(template.items)) // only completed /w items
    .map(inspection => createDeficientItems(inspection)) // create inspection's deficient items
    .filter(deficientItems => Object.keys(deficientItems).length); // remove non-deficient inspections

  // TODO: merge in state data from: `/propertyDeficientItems/<property_id>/<inspection_item_id>`
  //       into each deficientInspections items if they match

  // Count all deficient items
  config.updates[`/properties/${config.propertyId}/numOfDeficientItems`] = deficientInspections.reduce((acc, deficientItems) =>
    acc + Object.keys(deficientItems).length
  , 0);

  // Count all deficient items where state is `requires-action`
  config.updates[`/properties/${config.propertyId}/numOfRequiredActionsForDeficientItems`] = deficientInspections.reduce((acc, deficientItems) =>
    acc + Object.keys(deficientItems).filter(itemId => deficientItems[itemId].state === 'requires-action').length
  , 0);

  return config;
}
