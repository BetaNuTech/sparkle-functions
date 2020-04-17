const assert = require('assert');

// const PREFIX = 'properties: api: get-property-yardi-work-orders:';

/**
 * Factory for creating a GET endpoint
 * that fetches a properties Yardi Work Orders
 * @param {admin.database} db
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiResidents(db) {
  assert(Boolean(db), 'has firebase database');

  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req /* , res */) => {
    assert(req.property, 'has property set by middleware');
    // const property = req.property;
  };
};
