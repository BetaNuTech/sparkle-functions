const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const propertiesModel = require('../../models/properties');
const properties = require('../../properties');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch property:';

/**
 * Factory for creating a PATCH endpoint for
 * reassigning an inspection's property
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchProperty(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request for reassigning
   * an Inspection's property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { inspectionId } = params;
    const { property: propertyId } = body;
    const send500Error = create500ErrHandler(PREFIX, res);

    if (!propertyId) {
      return res.status(400).send({ message: 'body missing property' });
    }

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.val();
      if (!property) throw Error('Not found');
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
      return res.status(400).send({ message: 'body contains bad property' });
    }

    // Lookup Inspection
    let inspection = null;
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.val();
      if (!inspection) throw Error('Not found');
    } catch (err) {
      return res.status(409).send({
        message: 'requested inspection not found',
      });
    }

    const srcPropertyId = inspection.property;

    // Perform reassign on Realtime DB
    try {
      await inspectionsModel.reassignProperty(db, inspectionId, propertyId);
    } catch (err) {
      return send500Error(
        err,
        'inspection property reassignment failed',
        'unexpected error'
      );
    }

    // Perform reassign on Firestore
    try {
      await inspectionsModel.firestoreReassignProperty(
        fs,
        inspectionId,
        srcPropertyId,
        propertyId
      );
    } catch (err) {
      return send500Error(
        err,
        'firestore inspection property reassignment failed',
        'unexpected error'
      );
    }

    // Update source property meta data
    try {
      await properties.utils.processMeta(db, fs, srcPropertyId);
    } catch (err) {
      return send500Error(
        err,
        'source property metadata update failed',
        'unexpected error'
      );
    }

    // Update destination property meta data
    try {
      await properties.utils.processMeta(db, fs, propertyId);
    } catch (err) {
      return send500Error(
        err,
        'destination property metadata update failed',
        'unexpected error'
      );
    }

    res.status(201).send({ message: 'successful' });
  };
};
