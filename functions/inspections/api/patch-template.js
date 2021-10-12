const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-attr');
const validate = require('../utils/validate-update');
const updateInspection = require('../utils/update');
const propertiesModel = require('../../models/properties');

const PREFIX = 'inspection: api: patch-template:';

/**
 * Factory for updating inspection put request
 * that creates Firestore inspection
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @return {Function} - request handler
 */
module.exports = function patch(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const { inspectionId } = req.params;
    const send500Error = create500ErrHandler(PREFIX, res);
    const userUpdates = JSON.parse(JSON.stringify(body || {}));
    const hasUserUpdates = Boolean(Object.keys(userUpdates).length);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Update inspection requested');

    // Reject missing update request JSON
    if (!hasUserUpdates) {
      log.error(`${PREFIX} missing body`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: inspection update body required',
          },
        ],
      });
    }

    // Check payload contains non-updatable attributes
    if (doesContainInvalidAttr(userUpdates)) {
      log.error(`${PREFIX} request contains invalid attributes`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Payload contains non updatable attributes',
            detail: 'Can not update non-updatable attributes',
          },
        ],
      });
    }

    // Validate inspection atrributes
    const inspectionValidationErrors = validate({ ...userUpdates });
    const isValidUpdate = inspectionValidationErrors.length === 0;

    // Reject on invalid inspection update attributes
    if (!isValidUpdate) {
      log.error(`${PREFIX} bad request`);
      return res.status(400).send({
        errors: inspectionValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
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

    // Calculate new inspection result
    const inspectionUpdates = updateInspection(inspection, userUpdates);
    const hasInspectionUpdates = Boolean(Object.keys(inspectionUpdates).length);

    // Exit eairly if user updates
    // had no impact on inspection
    if (!hasInspectionUpdates) {
      return res.status(204).send();
    }

    // Start batch update
    const batch = db.batch();

    // Persist inspection updates
    try {
      await inspectionsModel.setRecord(
        db,
        inspectionId,
        inspectionUpdates,
        batch,
        true
      );
    } catch (err) {
      return send500Error(err, 'inspection write failed', 'unexpected error');
    }

    // checking for property meta data updates
    const { updatedLastDate } = inspectionUpdates;
    const hasUpdatedLastDate = Boolean(
      updatedLastDate && updatedLastDate !== inspection.updatedLastDate
    );

    // Update property meta data on inspection update
    if (hasUpdatedLastDate) {
      try {
        await propertiesModel.updateMetaData(db, inspection.property, batch);
      } catch (err) {
        log.error(`${PREFIX} property meta data update failed: ${err}`);
      }
    }

    // Atomically commit inspection/property writes
    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'inspection/property batch commit failed',
        'unexpected error'
      );
    }

    // Successful
    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: inspectionUpdates,
      },
    });
  };
};
