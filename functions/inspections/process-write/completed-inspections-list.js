const assert = require('assert');
const { getTemplateName, getScore } = require('./utils');

/**
 * Write an inspection's `completedInspectionsList`
 * @param  {firebaseAdmin.database} db
 * @param  {String} inspectionId
 * @param  {String} templateName
 * @param  {Object} inspection
 * @param  {Number} score
 * @return {Promise} - resolves {Object} completed inspection proxy
 */
module.exports = async function completedInspectionsList({
  db,
  inspectionId,
  inspection,
}) {
  assert(Boolean(db), 'has firebase database reference');
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection ID');
  assert(Boolean(inspection), 'has inspection data');

  if (!inspection.inspectionCompleted) {
    await db.ref(`/completedInspections/${inspectionId}`).remove(); // TODO remove #53
    await db.ref(`/completedInspectionsList/${inspectionId}`).remove();
    return null;
  }

  const completedInspectionData = {
    score: getScore(inspection),
    templateName: getTemplateName(inspection),
    inspector: inspection.inspector,
    inspectorName: inspection.inspectorName,
    creationDate: inspection.creationDate,
    updatedLastDate: inspection.updatedLastDate,
    deficienciesExist: inspection.deficienciesExist,
    inspectionCompleted: inspection.inspectionCompleted,
    property: inspection.property,
  };

  await db
    .ref(`/completedInspections/${inspectionId}`)
    .set(completedInspectionData); // TODO remove #53
  await db
    .ref(`/completedInspectionsList/${inspectionId}`)
    .set(completedInspectionData);
  return completedInspectionData;
};
