const assert = require('assert');
const { getTemplateName, getScore } = require('./utils');

const PREFIX = 'inspections: process-write: property-inspections-list:';

/**
 * Write an inspection's `propertyInspectionsList`
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} property inspection proxy
 */
module.exports = async function propertyInspectionsList({
  db,
  inspectionId,
  inspection,
}) {
  assert(Boolean(db), 'has firebase database reference');
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection ID');
  assert(Boolean(inspection), 'has inspection data');

  const inspectionData = {
    score: getScore(inspection),
    templateName: getTemplateName(inspection),
    inspector: inspection.inspector,
    inspectorName: inspection.inspectorName,
    creationDate: inspection.creationDate,
    updatedLastDate: inspection.updatedLastDate,
    deficienciesExist: inspection.deficienciesExist,
    inspectionCompleted: inspection.inspectionCompleted,
    itemsCompleted: inspection.itemsCompleted,
    totalItems: inspection.totalItems,
  };

  // Add optional template category
  if (inspection.templateCategory) {
    inspectionData.templateCategory = inspection.templateCategory;
  }

  try {
    await db
      .ref(
        `/propertyInspectionsList/${inspection.property}/inspections/${inspectionId}`
      )
      .set(inspectionData);
  } catch (err) {
    throw Error(`${PREFIX} set property inspection proxy failed | ${err}`);
  }

  return inspectionData;
};
