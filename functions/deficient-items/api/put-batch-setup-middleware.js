const assert = require('assert');
const deficiencyModel = require('../../models/deficient-items');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'deficient-items: api: put batch setup middleware:';

/**
 * Creates a middleware that looks up the deficiency's
 * property and adds it to the requet params for auth
 * to later validate
 * @param  {admin.firestore} db
 * @return {Promise} verification & lookup requests
 */
module.exports = function putBatchSetup(db) {
  assert(db && typeof db.collection === 'function', 'has database instance');

  return async function handler(req, res, next) {
    const send500Error = create500ErrHandler(PREFIX, res);
    const srcDeficiencyIds = (req.query || {}).id || '';
    const deficiencyIds = Array.isArray(srcDeficiencyIds)
      ? srcDeficiencyIds
      : [srcDeficiencyIds];
    const hasDeficiencyIds = Boolean(
      Array.isArray(deficiencyIds) &&
        deficiencyIds.length &&
        deficiencyIds.every(id => id && typeof id === 'string')
    );

    // Reject missing, required, deficient item ids
    if (!hasDeficiencyIds) {
      res.set('Content-Type', 'application/vnd.api+json');
      return res.status(400).send({
        errors: [
          {
            detail:
              'Bad Request: One or more deficient item ids must be provided as query params',
          },
        ],
      });
    }

    // Lookup first deficincy
    let deficiency = null;
    try {
      const deficiencySnap = await deficiencyModel.findRecord(
        db,
        deficiencyIds[0]
      );
      deficiency = deficiencySnap.data();
    } catch (err) {
      return send500Error(
        err,
        'deficient item lookup failed',
        'unexpected error'
      );
    }

    // Add deficiency's property
    // to the request params
    try {
      req.propertyId = deficiency.property || '';
    } catch (err) {
      return send500Error(
        err,
        'deficient item lookup failed',
        'unexpected error'
      );
    }

    // Proceed
    next();
  };
};
