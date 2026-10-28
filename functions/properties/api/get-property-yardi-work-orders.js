const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'properties: api: get-property-yardi-work-orders:';

/**
 * Factory for creating a GET endpoint
 * that fetches a properties Yardi Work Orders
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiWorkOrders() {
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
    const query = req.query || {};
    const send500Error = create500ErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Validate optional search filters
    const { filters, errors: filterErrors } = parseFilters(query);
    if (filterErrors.length) {
      log.error(`${PREFIX} invalid work order filters`);
      return res.status(400).send({
        errors: filterErrors.map(({ message, path }) => ({
          source: { parameter: path },
          detail: message,
        })),
      });
    }

    let workOrders = null;

    // Lookup Work Orders
    try {
      const result = await yardi.getYardiPropertyWorkOrders(
        property.code,
        yardiConfig,
        filters
      );
      workOrders = result.workOrders;
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

      // Unit filter unknown to Yardi
      if (err.code === 'ERR_NO_YARDI_UNIT') {
        return res.status(400).send({
          errors: [
            {
              detail: 'Unit does not exist for property in Yardi',
              source: { parameter: 'unit' },
            },
          ],
        });
      }

      // Property not enabled for the interface in Voyager
      if (err.code === 'ERR_YARDI_PROPERTY_NOT_CONFIGURED') {
        return res.status(403).send({
          errors: [
            {
              detail:
                'Yardi interface is not configured for this property in Voyager',
              source: { pointer: 'code' },
            },
          ],
        });
      }

      // Bad system integration credentials
      if (err.code === 'ERR_BAD_YARDI_CREDENTIALS') {
        return res.status(407).send({
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
        'Unexpected error fetching work orders, please try again'
      );
    }

    const json = { data: [] };

    // Push all work orders to payload
    // as JSON API formatted records
    workOrders.forEach(workOrder => {
      const result = {
        id: workOrder.id,
        type: 'work-order',
        attributes: { ...workOrder },
      };

      if (workOrder.resident) {
        result.relationships = {
          resident: {
            data: { id: workOrder.resident, type: 'resident' },
          },
        };
      }

      // Remove ID and relationships
      // from record attributes
      delete result.attributes.id;
      delete result.attributes.resident;

      json.data.push(result);
    });

    // Success
    res.status(200).send(json);
  };
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CLOSED_DAYS = 90;
const TEXT_FILTERS = Object.freeze(['unit', 'resident', 'status']);

/**
 * Parse work order search filters from
 * the request query string
 * @param  {Object} query
 * @return {Object} - { filters: Object, errors: Object[] }
 */
function parseFilters(query) {
  const filters = {};
  const errors = [];

  // Open (default) or closed work orders
  if (typeof query.state !== 'undefined') {
    const state = `${query.state}`.toLowerCase();
    if (!['open', 'closed'].includes(state)) {
      errors.push({ path: 'state', message: 'state must be open or closed' });
    } else {
      filters.openOrClosed = state;
    }
  }

  // Text filters
  TEXT_FILTERS.forEach(attr => {
    if (typeof query[attr] === 'undefined') return;
    const value = `${query[attr]}`.trim();
    if (!value || value.length > 30) {
      errors.push({
        path: attr,
        message: `${attr} must be between 1 and 30 characters`,
      });
    } else {
      filters[attr] = value;
    }
  });

  // Last modified date range
  ['from', 'to'].forEach(attr => {
    if (typeof query[attr] === 'undefined') return;
    const value = `${query[attr]}`.trim();
    if (!DATE_REGEX.test(value) || Number.isNaN(Date.parse(value))) {
      errors.push({ path: attr, message: `${attr} must be a YYYY-MM-DD date` });
    } else {
      filters[attr] = value;
    }
  });

  // Closed work orders span the property's entire
  // history, so default to recently modified ones
  if (filters.openOrClosed === 'closed' && !filters.from && !errors.length) {
    filters.from = toDateString(
      Date.now() - DEFAULT_CLOSED_DAYS * 24 * 60 * 60 * 1000
    );
  }

  return { filters, errors };
}

/**
 * Format a timestamp as YYYY-MM-DD (UTC)
 * @param  {Number} timestamp - milliseconds
 * @return {String}
 */
function toDateString(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
