const assert = require('assert');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'deficient-items: api: put batch setup middleware:';

/**
 * Creates a middleware that looks up the inspection's
 * property and adds it to the requet params for auth
 * to later validate
 * @param  {admin.firestore} db
 * @return {Promise} verification & lookup requests
 */
module.exports = function propertyAuthSetupMiddleware(db) {
  assert(db && typeof db.collection === 'function', 'has database instance');

  return async function handler(req, res, next) {
    const send500Error = create500ErrHandler(PREFIX, res);
    const { inspectionId } = req.params;

    // Lookup inspection
    let inspection = null;
    let propertyId = '';
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
      propertyId = inspection ? inspection.property : '';
    } catch (err) {
      return send500Error(err, 'inspection lookup failed', 'unexpected error');
    }

    // Add inspection's property
    // to the request params
    req.propertyId = propertyId || '';

    // Proceed
    next();
  };
};
