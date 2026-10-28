const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const toJsonApi = require('../utils/work-order-attachment-json-api');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: get-property-yardi-work-order-attachment:';

/**
 * Factory for creating a GET endpoint that
 * fetches one Yardi work order attachment
 * by file name, including its base64 data
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiWorkOrderAttachment() {
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
    const { workOrderId, attachmentName } = params;
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `${PREFIX} attachment "${attachmentName}" of Yardi work order "${workOrderId}" requested`
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

    // Lookup attachments (Yardi only
    // returns all files of a work order)
    let attachments = null;
    try {
      attachments = await yardi.getYardiWorkOrderAttachments(
        property.code,
        yardiConfig,
        workOrderId
      );
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error fetching work order attachment, please try again'
      );
    }

    const attachment = attachments.find(
      ({ name }) =>
        `${name}`.toLowerCase() === `${attachmentName}`.toLowerCase()
    );

    if (!attachment) {
      return res.status(404).send({
        errors: [
          {
            detail: 'Attachment does not exist for work order in Yardi',
            source: { pointer: 'attachmentName' },
          },
        ],
      });
    }

    // Success
    res.status(200).send({ data: toJsonApi(attachment, true) });
  };
};
