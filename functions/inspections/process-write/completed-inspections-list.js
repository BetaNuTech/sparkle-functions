const assert = require('assert');

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
  templateName,
  inspection,
  score
}) {
  assert(Boolean(db), 'has firebase database reference');
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection ID');
  assert(templateName && typeof templateName === 'string', 'has template name');
  assert(Boolean(inspection), 'has inspection data');
  assert(score === score && typeof score === 'number', 'has inspection score');

  if (!inspection.inspectionCompleted) {
    await db.ref(`/completedInspections/${inspectionId}`).remove(); // TODO remove #53
    await db.ref(`/completedInspectionsList/${inspectionId}`).remove();
    return null;
  }

  const completedInspectionData = {
    score,
    templateName,
    inspector: inspection.inspector,
    inspectorName: inspection.inspectorName,
    creationDate: inspection.creationDate,
    updatedLastDate: inspection.updatedLastDate,
    deficienciesExist: inspection.deficienciesExist,
    inspectionCompleted: inspection.inspectionCompleted,
    property: inspection.property
  };

  await db.ref(`/completedInspections/${inspectionId}`).set(completedInspectionData); // TODO remove #53
  await db.ref(`/completedInspectionsList/${inspectionId}`).set(completedInspectionData);
  return completedInspectionData;
}
