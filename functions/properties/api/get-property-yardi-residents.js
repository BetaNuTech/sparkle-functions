const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const create500ErrHandler = require('../../utils/unexpected-api-error');
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
    const send500Error = create500ErrHandler(PREFIX, res);

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

    // Make Yardi API request
    let residents = null;
    let occupants = null;
    try {
      const result = await yardi.getYardiPropertyResidents(
        property.code,
        yardiConfig
      );
      residents = result.residents;
      occupants = result.occupants;
    } catch (err) {
      return send500Error(
        err,
        'Yard request failed',
        'Unexpected error fetching residents, please try again'
      );
    }

    const json = {
      data: [],
      included: [],
    };

    // Add occupant records
    residents.forEach(src => {
      const attributes = { ...src }; // clone
      const { id, occupants: occupantsRefs } = attributes;
      delete attributes.id;
      delete attributes.occupants;

      const record = {
        id,
        type: 'resident',
        attributes,
      };

      if (occupantsRefs && occupantsRefs.length) {
        record.relationships = {
          occupants: {
            data: occupantsRefs.map(occId => ({ id: occId, type: 'occupant' })),
          },
        };
      }

      json.data.push(record);
    });

    // Add side loaded occupant records
    occupants.forEach(src => {
      const attributes = { ...src }; // clone
      const { id, resident: residentRef } = attributes;
      delete attributes.id;
      delete attributes.resident;

      const record = {
        id,
        type: 'occupant',
        attributes,
      };

      record.relationships = {
        resident: {
          data: { id: residentRef, type: 'resident' },
        },
      };

      json.included.push(record);
    });

    // Success
    res.status(200).send(json);
  };
};
