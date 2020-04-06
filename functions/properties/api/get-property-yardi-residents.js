const assert = require('assert');
// const log = require('../../utils/logger');
// const create500ErrHandler = require('../../utils/unexpected-error-handler');
// const propertiesModel = require('../../models/properties');
// const usersModel = require('../../models/users');

// const PREFIX = 'properties: api: get-property-yardi-residents:';

/**
 * Factory for creating a GET endpoint
 * that fetches a properties Yardi residents
 * @param {admin.firestore} fs
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiResidents(fs) {
  assert(Boolean(fs), 'has firebase database');

  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    // const { params } = req;
    // const { propertyId } = params;
    // const send500Error = create500ErrHandler(PREFIX, res);

    // TODO: Lookup property
    // TODO: property 404

    // if (!property.code) {
    //   return res.status(403).send({
    //     errors: [
    //       {
    //         detail: 'Property Code not set for Yardi request',
    //         source: { pointer: 'code' },
    //       },
    //     ],
    //   });
    // }

    // TODO: Lookup company config

    // Yardi not configured for the company
    // if (hasYardiConfig) {
    //   return res.status(403).send({
    //     errors: [
    //       {
    //         detail: 'Yardi not configured for company'
    //       },
    //     ],
    //   });
    // }

    // TODO convert JSON to XML request payload
    // TODO make yardi request
    // TODO munge yardi XML response to JSON
    // TODO cleanup phone number formatting & remove duplicates
    // TODO Send JSON API response w/ side loaded occupants

    // Success
    res.status(200).send();
  };
};
