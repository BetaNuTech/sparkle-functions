const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const propertiesModel = require('../../models/properties');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch property:';

/**
 * Factory for creating a PATCH endpoint for
 * reassigning an inspection's property
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchProperty(fs) {
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

    // Lookup Firestore Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      property = propertySnap.data() || null;
      if (!property) throw Error('Not found');
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
      return res.status(400).send({ message: 'body contains bad property' });
    }

    // Lookup Firestore Inspection
    let inspection = null;
    try {
      const inspectionSnap = await inspectionsModel.firestoreFindRecord(
        fs,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
      if (!inspection) throw Error('Not found');
    } catch (err) {
      log.error(`${PREFIX} inspection lookup failed | ${err}`);
      return res.status(409).send({
        message: 'requested inspection not found',
      });
    }

    const srcPropertyId = inspection.property;

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
        'inspection property reassignment failed',
        'unexpected error'
      );
    }

    try {
      const batch = fs.batch();
      await propertiesModel.updateMetaData(fs, srcPropertyId, batch);
      await propertiesModel.updateMetaData(fs, propertyId, batch);
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'properties metadata update failed',
        'unexpected error'
      );
    }

    res.status(201).send({ message: 'successful' });
  };
};
