const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const cobalt = require('../../services/cobalt');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'properties: api: get-property-yardi-residents:';

/**
 * Factory for creating a GET endpoint
 * that fetches a properties Yardi residents
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
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const property = req.property;
    const yardiConfig = req.yardiConfig;
    const send500Error = create500ErrHandler(PREFIX, res);

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
        'Yardi request failed',
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

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

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
    result.eviction = Boolean(found.eviction) || false;
    result.paymentPlan = Boolean(found.payment_plan) || false;
    result.paymentPlanDelinquent =
      Boolean(found.payment_plan_delinquent) || false;
    if (found.last_note) result.lastNote = found.last_note;
    try {
      // Convert any note
      // update timestamp to unix
      if (found.last_note_updated_at)
        result.lastNoteUpdatedAt = Math.round(
          new Date(found.last_note_updated_at).getTime() / 1000
        );
    } catch (err) {} // eslint-disable-line no-empty
    return result;
  };
}
