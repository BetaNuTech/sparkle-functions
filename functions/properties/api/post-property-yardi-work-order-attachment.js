const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const validate = require('../utils/validate-work-order-attachment');
const toJsonApi = require('../utils/work-order-attachment-json-api');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: post-property-yardi-work-order-attachment:';

/**
 * Factory for creating a POST endpoint that
 * uploads a file (base64) to a Yardi work order
 * @return {Function} - onRequest handler
 */
module.exports = function createPostYardiWorkOrderAttachment() {
  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const { property, yardiConfig, params } = req;
    const { workOrderId } = params;
    const attachment = req.body && typeof req.body === 'object' ? req.body : {};
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `${PREFIX} attachment upload to Yardi work order "${workOrderId}" requested`
    );

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

    // Validate attachment payload
    const validationErrors = validate(attachment);
    if (validationErrors.length) {
      log.error(`${PREFIX} invalid attachment request`);
      return res.status(400).send({
        errors: validationErrors.map(({ message, path }) => ({
          source: { pointer: path },
          detail: message,
        })),
      });
    }

    // Upload to Yardi
    let uploaded = null;
    try {
      uploaded = await yardi.uploadYardiWorkOrderAttachment(
        property.code,
        yardiConfig,
        workOrderId,
        {
          data: attachment.data,
          extension: attachment.extension,
          description: attachment.description || '',
        }
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error uploading work order attachment, please try again'
      );
    }

    // Success
    res.status(201).send({
      data: toJsonApi({
        ...uploaded,
        createdAt: new Date().toISOString(),
        size: Buffer.from(attachment.data, 'base64').length,
      }),
    });
  };
};
