const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const validate = require('../utils/validate-work-order');
const toJsonApi = require('../utils/work-order-json-api');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: patch-property-yardi-work-order:';

/**
 * Factory for creating a PATCH endpoint
 * that updates an existing work order
 * (service request) for a property in Yardi
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchYardiWorkOrder() {
  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const { property, yardiConfig, params } = req;
    const { workOrderId } = params;
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`${PREFIX} update Yardi work order "${workOrderId}" requested`);

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

    // Reject updates to the ID itself
    if (typeof updates.id !== 'undefined') {
      return res.status(400).send({
        errors: [
          {
            detail: 'id cannot be updated',
            source: { pointer: 'id' },
          },
        ],
      });
    }

    // Validate work order updates
    const validationErrors = validate(updates, true);
    if (validationErrors.length) {
      log.error(`${PREFIX} invalid work order update request`);
      return res.status(400).send({
        errors: validationErrors.map(({ message, path }) => ({
          source: { pointer: path },
          detail: message,
        })),
      });
    }

    // Verify the work order exists for this property,
    // Yardi would otherwise silently create a new one
    let existing = null;
    try {
      existing = await yardi.getYardiPropertyWorkOrder(
        property.code,
        yardiConfig,
        workOrderId
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error looking up work order, please try again'
      );
    }

    // Update work order in Yardi, which
    // requires the unit alongside the ID
    let updated = null;
    try {
      updated = await yardi.createOrEditYardiWorkOrder(
        property.code,
        yardiConfig,
        {
          unit: existing.unit,
          ...updates,
          id: workOrderId,
        }
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error updating work order, please try again'
      );
    }

    // Success
    res.status(200).send({ data: toJsonApi(updated) });
  };
};
