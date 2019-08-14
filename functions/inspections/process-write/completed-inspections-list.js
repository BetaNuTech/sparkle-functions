const assert = require('assert');
const { getTemplateName, getScore } = require('./utils');

const PREFIX = 'inspections: process-write: completed-inspections-list:';

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

  let completedInspectionData = null;

  if (!inspection.inspectionCompleted) {
    try {
      await db.ref(`/completedInspectionsList/${inspectionId}`).remove();
    } catch (err) {
      throw Error(`${PREFIX} failed to remove incomplete inspection | ${err}`);
    }
  } else {
    completedInspectionData = {
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

    try {
      await db
        .ref(`/completedInspectionsList/${inspectionId}`)
        .set(completedInspectionData);
    } catch (err) {
      throw Error(`${PREFIX} failed to set complete inspection data | ${err}`);
    }
  }

  return completedInspectionData;
};
