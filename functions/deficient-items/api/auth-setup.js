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
module.exports = function upsertAuthSetup(db) {
  assert(db && typeof db.collection === 'function', 'has database instance');

  return async function handler(req, res, next) {
    const send500Error = create500ErrHandler(PREFIX, res);
    const srcDeficiencyIds = (req.query || {}).id || '';
    const { deficiencyId: paramDeficiencyId = '' } = req.params;
    const deficiencyIds = (Array.isArray(srcDeficiencyIds)
      ? srcDeficiencyIds
      : [srcDeficiencyIds]
    ).filter(Boolean);

    // Add any deficient item identifier
    // specified in the url path wildard
    if (paramDeficiencyId) {
      deficiencyIds.push(paramDeficiencyId);
    }

    // Chech if any deficienices referenced
    // in either the query params or URL path
    const hasDeficiencyIds = Boolean(
      Array.isArray(deficiencyIds) &&
        deficiencyIds.length &&
        deficiencyIds.every(id => id && typeof id === 'string')
    );

    // Proceed without providing any
    // validation for property-level users
    if (!hasDeficiencyIds) {
      return next();
    }

    // Lookup first deficincy
    let deficiency = null;
    let propertyId = '';
    try {
      const deficiencySnap = await deficiencyModel.findRecord(
        db,
        deficiencyIds[0]
      );
      deficiency = deficiencySnap.data() || null;
      propertyId = deficiency ? deficiency.property : '';
    } catch (err) {
      return send500Error(
        err,
        'deficient item lookup failed',
        'unexpected error'
      );
    }

    // Add deficiency's property
    // to the request params
    req.propertyId = propertyId || '';

    // Proceed
    next();
  };
};
