const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const propertiesModel = require('../../models/properties');

const PREFIX = 'inspections: api: patch property:';

/**
 * Factory for creating a PATCH endpoint for
 * reassigning an inspection's property
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchProperty(db) {
  assert(Boolean(db), 'has firebase database instance');

  /**
   * Handle PATCH request for reassigning
   * an Inspection's property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body } = req;
    const { inspectionId } = params;
    const { property: propertyId } = body;

    if (!inspectionId) {
      return res
        .status(400)
        .send({ message: 'request URL missing inspection reference' });
    }

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
      return res
        .status(400)
        .send({ message: 'request payload given invalid property reference' });
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
        message: 'Requested inspection could not be found',
      });
    }

    // TODO reassign inspection's property

    res.status(201).send({ message: 'successful' });
  };
};
