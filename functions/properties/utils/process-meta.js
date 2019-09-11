const pipe = require('lodash/fp/flow');
const log = require('../../utils/logger');
const defItemsModel = require('../../models/deficient-items');
const { deficientItems } = require('../../config');
const createDeficientItems = require('../../deficient-items/utils/create-deficient-items');

const PREFIX = 'properties: utils: process-meta:';
const REQUIRED_ACTIONS_VALUES = deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = deficientItems.followUpActionStates;
const EXCLUDED_DI_COUNTER_VALUES =
  deficientItems.excludedPropertyNumOfDeficientItemsStates;

// Pipeline of steps to update metadata
const propertyMetaUpdates = pipe([
  updateNumOfInspections,
  updateLastInspectionAttrs,
  updateDeficientItemsAttrs,
]);

/**
 * Process changes to a property's
 * metadata if it's inspections chanage
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {String} propertyId
 * @return {Promise} - resolves {Object} updates
 */
module.exports = async function processMeta(db, propertyId) {
  try {
    // Find all property's inspections
    const inspectionsSnap = await db
      .ref('/inspections')
      .orderByChild('property')
      .equalTo(propertyId)
      .once('value');
    const inspectionsData = inspectionsSnap.exists()
      ? inspectionsSnap.val()
      : {};
    const inspections = Object.keys(inspectionsData).map(inspId =>
      Object.assign({ id: inspId }, inspectionsData[inspId])
    );

    if (!inspections.length) {
      return {};
    }

    // Find any deficient items data for property
    const propertyInspectionDeficientItemsSnap = await defItemsModel.findAllByProperty(
      db,
      propertyId
    );
    const propertyInspectionDeficientItemsData = propertyInspectionDeficientItemsSnap.exists()
      ? propertyInspectionDeficientItemsSnap.val()
      : {};
    const deficientItemsCurrent = Object.keys(
      propertyInspectionDeficientItemsData
    )
      .filter(defItemId =>
        Boolean(propertyInspectionDeficientItemsData[defItemId].state)
      ) // require state
      .map(defItemId =>
        Object.assign(
          { id: defItemId },
          propertyInspectionDeficientItemsData[defItemId]
        )
      );

    // Collect updates to write to property's metadata attrs
    const { updates } = propertyMetaUpdates({
      propertyId,
      inspections,
      deficientItems: deficientItemsCurrent,
      updates: Object.create(null),
    });

    // Atomically write each metadata update
    const updatePaths = Object.keys(updates);
    for (let i = 0; i < updatePaths.length; i++) {
      const path = updatePaths[i];
      await db.ref(path).set(updates[path]);
    }

    log.info(`${PREFIX} successfully updated property: ${propertyId} metadata`);
    return updates;
  } catch (err) {
    log.error(`${PREFIX} failed updating property metadata | ${err}`);
    return null;
  }
};

/**
 * Configure update for all a property's
 * completed inspections
 * @param  {String} propertyId
 * @param  {Object[]} inspections
 * @param  {Object} updates
 * @return {Object} - configuration
 */
function updateNumOfInspections(
  config = { propertyId: '', inspections: [], updates: {} }
) {
  config.updates[
    `/properties/${config.propertyId}/numOfInspections`
  ] = config.inspections.reduce((acc, { inspectionCompleted }) => {
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
function updateLastInspectionAttrs(
  config = { propertyId: '', inspections: [], updates: {} }
) {
  const [latestInspection] = config.inspections.sort(
    (a, b) => b.creationDate - a.creationDate
  ); // DESC

  if (latestInspection && latestInspection.inspectionCompleted) {
    config.updates[`/properties/${config.propertyId}/lastInspectionScore`] =
      latestInspection.score;
    config.updates[`/properties/${config.propertyId}/lastInspectionDate`] =
      latestInspection.creationDate;
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
function updateDeficientItemsAttrs(
  config = {
    propertyId: '',
    inspections: [],
    deficientItems: [],
    updates: {},
  }
) {
  const deficientItemsLatest = [].concat(
    ...config.inspections // flatten
      .filter(
        ({ inspectionCompleted, template }) =>
          inspectionCompleted &&
          Boolean(template) &&
          Boolean(template.trackDeficientItems) &&
          Boolean(template.items)
      ) // only completed, DI enabled, /w items
      .map(inspection => createDeficientItems(inspection)) // create inspection's deficient items
      .filter(calcDeficientItems => Object.keys(calcDeficientItems).length) // remove non-deficient inspections
      .map(defItems => {
        // Merge latest state from:
        // `/propertyInspectionDeficientItems/...` into
        // deficient items calculated from inspections
        Object.keys(defItems).forEach(id => {
          const itemId = defItems[id].item;
          const inspId = defItems[id].inspection;
          const [existingDefItem] = config.deficientItems.filter(
            ({ item, inspection }) => item === itemId && inspection === inspId
          );
          Object.assign(defItems[id], existingDefItem || {}); // merge existingDefItem state
        });
        return defItems;
      })
      .map(defItems => {
        // Convert nested objects of inspections DI's
        // into grouped array's of inspection DI's
        const defItemsArr = [];
        Object.keys(defItems).forEach(defItemId =>
          defItemsArr.push(defItems[defItemId])
        );
        return defItemsArr;
      })
  );

  // Count all deficient items
  config.updates[
    `/properties/${config.propertyId}/numOfDeficientItems`
  ] = deficientItemsLatest.filter(
    ({ state }) => !EXCLUDED_DI_COUNTER_VALUES.includes(state)
  ).length;

  // Count all deficient items where state requires action
  config.updates[
    `/properties/${config.propertyId}/numOfRequiredActionsForDeficientItems`
  ] = deficientItemsLatest.filter(({ state }) =>
    REQUIRED_ACTIONS_VALUES.includes(state)
  ).length;

  // Count all deficient items where state requires follow up
  config.updates[
    `/properties/${config.propertyId}/numOfFollowUpActionsForDeficientItems`
  ] = deficientItemsLatest.filter(({ state }) =>
    FOLLOW_UP_ACTION_VALUES.includes(state)
  ).length;

  return config;
}
