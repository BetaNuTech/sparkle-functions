const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const toJsonApi = require('../utils/work-order-json-api');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: get-property-yardi-work-order:';

/**
 * Factory for creating a GET endpoint
 * that fetches a single Yardi work order
 * (service request) belonging to a property
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiWorkOrder() {
  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const { property, yardiConfig, params } = req;
    const { workOrderId } = params;
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`${PREFIX} Yardi work order "${workOrderId}" requested`);

    // Reject non-numeric Yardi work order IDs
    if (!/^\d+$/.test(`${workOrderId}`)) {
      return res.status(400).send({
        errors: [
          {
            detail: 'work order id must be numeric',
            source: { pointer: 'workOrderId' },
          },
        ],
      });
    }

    // Lookup work order
    let workOrder = null;
    try {
      workOrder = await yardi.getYardiPropertyWorkOrder(
        property.code,
        yardiConfig,
        workOrderId
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error fetching work order, please try again'
      );
    }

    // Success
    res.status(200).send({ data: toJsonApi(workOrder) });
  };
};
