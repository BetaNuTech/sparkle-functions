const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const validate = require('../utils/validate-work-order');
const toJsonApi = require('../utils/work-order-json-api');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: post-property-yardi-work-order:';

/**
 * Factory for creating a POST endpoint
 * that creates a work order (service request)
 * for a property in Yardi
 * @return {Function} - onRequest handler
 */
module.exports = function createPostYardiWorkOrder() {
  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const { property, yardiConfig } = req;
    const workOrder = req.body && typeof req.body === 'object' ? req.body : {};
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`${PREFIX} create Yardi work order requested`);

    // Reject a work order ID, which would
    // make Yardi edit instead of create
    if (workOrder.id) {
      return res.status(400).send({
        errors: [
          {
            detail: 'id is not allowed when creating a work order',
            source: { pointer: 'id' },
          },
        ],
      });
    }

    // Validate work order attributes
    const validationErrors = validate(workOrder);
    if (validationErrors.length) {
      log.error(`${PREFIX} invalid work order request`);
      return res.status(400).send({
        errors: validationErrors.map(({ message, path }) => ({
          source: { pointer: path },
          detail: message,
        })),
      });
    }

    // Create work order in Yardi
    let created = null;
    try {
      created = await yardi.createOrEditYardiWorkOrder(
        property.code,
        yardiConfig,
        workOrder
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error creating work order, please try again'
      );
    }

    // Success
    res.status(201).send({ data: toJsonApi(created) });
  };
};
