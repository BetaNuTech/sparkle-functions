const assert = require('assert');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
// const insertInspectionItemImageUris = require('./utils/download-inspection-images');
const log = require('../../utils/logger');

const PREFIX = 'inspections: api: get-report-pdf:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetReportPdfHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Generate an inspection PDF report for an inspection
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspection: inspectionId } = req.params;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Lookup Firebase Inspection
    let propertyId = '';
    let inspection = null;
    let hasPreviousPDFReport = false;

    // Prioritize firestore record
    try {
      const inspectionSnap = await inspectionsModel.firestoreFindRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} inspection lookup failed | ${err}`);
    }

    // Reject request for invalid inspection
    if (!inspection) {
      log.error(`${PREFIX} inspection "${inspectionId}" does not exist`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" could not be found`,
          },
        ],
      });
    }

    if (!inspection.property) {
      log.error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" not associated with a property`,
          },
        ],
      });
    }

    // Setup variables for processing request
    propertyId = inspection.property;
    hasPreviousPDFReport = Boolean(inspection.inspectionReportUpdateLastDate);

    // Lookup property
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        db,
        propertyId
      );
      property = propertySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
    }

    if (!property) {
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: associated property "${propertyId}" could not be recovered`,
          },
        ],
      });
    }

    property.id = propertyId;

    // Create item photo data hash
    // let inspPhotoData = null;
    // try {
    //   const inspClone = JSON.parse(JSON.stringify(inspection));
    //   const inspectionUris = await insertInspectionItemImageUris(inspClone);
    //   inspPhotoData = inspectionUris.template.items;
    // } catch (err) {
    //   log.error(`${PREFIX} inspection item photo lookup failed | ${err}`);
    //   return res.status(500).send({
    //     errors: [{ detail: 'Inspection Attachment data Error' }],
    //   });
    // }

    // Send updated inspection
    res.status(200).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        data: inspection,
      },
    });
  };
};
