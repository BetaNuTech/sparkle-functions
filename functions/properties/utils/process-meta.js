const pipe = require('lodash/fp/flow');
const defItemsModel = require('../../models/deficient-items');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const updateDeficientItemsAttrs = require('./update-deficient-items-attrs');

const PREFIX = 'properties: utils: process-meta:';

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
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param  {String} propertyId
 * @return {Promise} - resolves {Object} updates
 */
module.exports = async function processMeta(db, fs, propertyId) {
  let inspectionsSnap = null;

  // Lookup all property's inspections
  try {
    inspectionsSnap = await inspectionsModel.queryByProperty(db, propertyId);
  } catch (err) {
    throw Error(`${PREFIX} property inspection lookup failed: ${err}`);
  }

  const inspectionsData = inspectionsSnap.exists() ? inspectionsSnap.val() : {};
  const inspections = Object.keys(inspectionsData).map(inspId =>
    Object.assign({ id: inspId }, inspectionsData[inspId])
  );

  // if (!inspections.length) {
  //   return {};
  // }

  let propertyInspectionDeficientItemsSnap = null;

  // Find any deficient items data for property
  try {
    propertyInspectionDeficientItemsSnap = await defItemsModel.findAllByProperty(
      db,
      propertyId
    );
  } catch (err) {
    throw Error(
      `${PREFIX} failed to lookup properties deficicent items: ${err}`
    );
  }

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
    updates: {},
  });

  // Update Realtime Property
  try {
    await propertiesModel.realtimeUpsertRecord(db, propertyId, updates);
  } catch (err) {
    throw Error(`${PREFIX} failed updating realtime property metadata: ${err}`);
  }

  // Update Firebase Property
  try {
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, updates);
  } catch (err) {
    throw Error(
      `${PREFIX} failed updating firestore property metadata: ${err}`
    );
  }

  return updates;
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
  config.updates.numOfInspections = config.inspections.reduce(
    (acc, { inspectionCompleted }) => {
      if (inspectionCompleted) {
        acc += 1;
      }

      return acc;
    },
    0
  );

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
    config.updates.lastInspectionScore = latestInspection.score;
    config.updates.lastInspectionDate = latestInspection.creationDate;
  }

  return config;
}
