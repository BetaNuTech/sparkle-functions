const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch-unit-number:';
const MAX_UNIT_NUMBER_LENGTH = 24;

/**
 * Factory for creating a PATCH endpoint that
 * updates an inspection's optional unit number
 * without effecting any other inspection
 * attributes, timestamps, or report generation
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchUnitNumber(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request for updating
   * an Inspection's unit number
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { inspectionId } = params;
    const { unitNumber } = body;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `${PREFIX} Update unit number requested for inspection: "${inspectionId}"`
    );

    // Reject missing unit number attribute
    if (unitNumber === undefined) {
      log.error(`${PREFIX} missing body unit number`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'unitNumber' },
            title: 'body missing unit number',
            detail: 'Bad Request: inspection unit number update body required',
          },
        ],
      });
    }

    // Reject non-string unit number
    if (typeof unitNumber !== 'string') {
      log.error(`${PREFIX} non-string unit number provided`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'unitNumber' },
            title: 'body contains bad unit number',
            detail: 'Bad Request: inspection unit number must be a string',
          },
        ],
      });
    }

    const finalUnitNumber = unitNumber.trim();

    // Reject overly long unit number
    if (finalUnitNumber.length > MAX_UNIT_NUMBER_LENGTH) {
      log.error(`${PREFIX} unit number exceeds max length`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'unitNumber' },
            title: 'body contains bad unit number',
            detail: `Bad Request: inspection unit number must be ${MAX_UNIT_NUMBER_LENGTH} characters or less`,
          },
        ],
      });
    }

    // Lookup Inspection
    let inspection = null;
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'inspection lookup failed', 'unexpected error');
    }

    // Invalid inspection
    if (!inspection) {
      log.error(
        `${PREFIX} requested inspection: "${inspectionId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'inspection' },
            title: 'Inspection not found',
          },
        ],
      });
    }

    // Persist unit number only, deliberately
    // avoiding the inspection update pipeline
    // so completionDate/updatedAt/updatedLastDate
    // are untouched and no PDF report is queued
    try {
      await inspectionsModel.updateRecord(db, inspectionId, {
        unitNumber: finalUnitNumber,
      });
    } catch (err) {
      return send500Error(
        err,
        'inspection unit number write failed',
        'unexpected error'
      );
    }

    log.info(
      `${PREFIX} successfully updated unit number for inspection: "${inspectionId}"`
    );

    // Successful
    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: { unitNumber: finalUnitNumber },
      },
    });
  };
};
