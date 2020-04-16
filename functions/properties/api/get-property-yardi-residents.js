const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const cobalt = require('../../services/cobalt');
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

    // Make Yardi & Cobalt API request
    let residents = null;
    let occupants = null;
    let findCobaltTenant = () => ({});
    let cobaltTimestamp = 0;
    try {
      const [result, cobaltData] = await Promise.all([
        yardi.getYardiPropertyResidents(property.code, yardiConfig),
        requestCobaltTenants(db, property.code),
      ]);
      residents = result.residents;
      occupants = result.occupants;
      findCobaltTenant = getCobaltTenant(cobaltData.data);
      if (cobaltData.timestamp) cobaltTimestamp = cobaltData.timestamp;
    } catch (err) {
      if (err.code) log.error(`${PREFIX} | ${err}`);

      // Bad property code
      if (err.code === 'ERR_NO_YARDI_PROPERTY') {
        return res.status(404).send({
          errors: [
            {
              detail: 'Configured yardi code for property returned no results',
              source: { pointer: 'code' },
            },
          ],
        });
      }

      // Bad system integration credentials
      if (err.code === 'ERR_BAD_YARDI_CREDENTIALS') {
        return res.status(401).send({
          errors: [
            {
              detail: 'Yardi integration credentials not accepted',
            },
          ],
        });
      }

      return send500Error(
        err,
        'Yard request failed',
        'Unexpected error fetching residents, please try again'
      );
    }

    const json = {
      meta: {},
      data: [],
      included: [],
    };

    // Add Cobalt timestamp
    // to response metadata
    if (cobaltTimestamp) {
      json.meta.cobaltTimestamp = cobaltTimestamp;
    }

    // Add occupant records
    residents.forEach(src => {
      const attributes = { ...src }; // clone
      const { id, occupants: occupantsRefs } = attributes;
      delete attributes.id;
      delete attributes.occupants;
      Object.assign(attributes, findCobaltTenant(id)); // Merge in any Cobalt data

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

/**
 * Request Cobalt Tenant data
 * allowing for request to fail
 * @param {admin.database} db
 * @param  {String} propertyCode
 * @return {Promise} - resolves {Object}
 */
function requestCobaltTenants(db, propertyCode) {
  return cobalt.getPropertyTenants(db, propertyCode).catch(err => {
    log.error(`${PREFIX} Cobalt tenant request failed: ${err}`);
    return { data: [] }; // ignore failure
  });
}

function getCobaltTenant(data) {
  assert(Array.isArray(data), 'has data array');

  /**
   * Lookup and munge any
   * found tenant data into
   * camel casing
   * @param  {String} id
   * @return {Object}
   */
  return id => {
    assert(id && typeof id === 'string', 'has string');
    const result = {};

    // Find & replace w/ camelcase
    const found = data.find(({ tenant_code }) => tenant_code === id) || {}; // eslint-disable-line camelcase
    if (found.total_owed) result.totalOwed = parseFloat(found.total_owed);
    if (found.total_charges)
      result.totalCharges = parseFloat(found.total_charges);
    if (found.payment_plan) result.paymentPlan = found.payment_plan;
    if (found.payment_plan_delinquent)
      result.paymentPlanDelinquent = found.payment_plan_delinquent;
    if (found.last_note) result.lastNote = found.last_note;
    return result;
  };
}
