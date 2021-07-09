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
    const send500Error = create500ErrHandler(PREFIX, res);

    let workOrders = null;

    // Lookup Work Orders
    try {
      const result = await yardi.getYardiPropertyWorkOrders(
        property.code,
        yardiConfig
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

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Success
    res.status(200).send(json);
  };
};
