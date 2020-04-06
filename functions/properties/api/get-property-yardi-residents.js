const assert = require('assert');
const log = require('../../utils/logger');
// const create500ErrHandler = require('../../utils/unexpected-api-error');
const propertiesModel = require('../../models/properties');
const systemModel = require('../../models/system');

const PREFIX = 'properties: api: get-property-yardi-residents:';

/**
 * Factory for creating a GET endpoint
 * that fetches a properties Yardi residents
 * @param {admin.database} db
 * @param {admin.firestore} fs
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiResidents(db, fs) {
  assert(Boolean(db), 'has firebase database');
  assert(Boolean(fs), 'has firestore database');

  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const { propertyId } = params;
    // const send500Error = create500ErrHandler(PREFIX, res);

    let property = null;

    // Lookup requested property
    try {
      if (!propertyId) throw Error('no property ID provided');
      const propertyDoc = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      if (!propertyDoc.exists) throw Error('property does not exist');
      property = propertyDoc.data();
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
      return res.status(404).send({
        errors: [
          {
            detail: 'property does not exist',
          },
        ],
      });
    }

    // Reject property /wo Yardi code
    if (!property.code) {
      return res.status(403).send({
        errors: [
          {
            detail: 'Property code not set for Yardi request',
            source: { pointer: 'code' },
          },
        ],
      });
    }

    let yardiConfig = null;

    // Lookup Yardi Integration
    try {
      const yardiSnap = await systemModel.findYardiCredentials(db);
      yardiConfig = yardiSnap.val();
      if (!yardiConfig) throw Error('Yardi not configured for organization');
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      return res.status(403).send({
        errors: [
          {
            detail: 'Organization not configured for Yardi',
            source: { pointer: 'code' },
          },
        ],
      });
    }

    // TODO convert JSON to XML request payload
    // TODO make yardi request
    // TODO munge yardi XML response to JSON
    // TODO cleanup phone number formatting & remove duplicates
    // TODO Send JSON API response w/ side loaded occupants

    // Success
    res.status(200).send();
  };
};
